import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

// AUTH_MODE=local swaps real Cognito JWT verification for a fixed, unsigned
// dev token mapped straight onto a seeded user's cognitoSub — see
// encodeLocalToken/decodeLocalToken below and POST /auth/local-login in
// index.ts, which only exists when this is 'local'. It's what makes
// `docker compose up` runnable with no AWS account: without it, the line
// that built the real Cognito verifier ran at import time with
// `process.env.COGNITO_USER_POOL_ID!` — a non-null assertion on a value
// that's genuinely undefined outside a deployed environment — and crashed
// the whole process before it could serve a single request.
//
// The NODE_ENV guard below is what stops that convenience from becoming a
// production auth bypass: setting AUTH_MODE=local with NODE_ENV=production
// crashes on purpose, immediately and loudly, at startup — not a runtime
// check that could be missed on one request path.
export const AUTH_MODE = (process.env.AUTH_MODE || 'cognito').toLowerCase();

if (AUTH_MODE === 'local' && process.env.NODE_ENV === 'production') {
  throw new Error(
    'AUTH_MODE=local is not allowed when NODE_ENV=production. This mode skips real token verification and must never run in a deployed environment.'
  );
}

// Real Cognito verification needs COGNITO_USER_POOL_ID/CLIENT_ID, which
// only exist outside local dev. Built lazily (only on first use, and only
// when AUTH_MODE isn't 'local') so importing this module never crashes —
// only actually trying to verify a token without those values configured
// does, with a clear message instead of the old `.match()` TypeError.
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;
function getVerifier() {
  if (!verifier) {
    const userPoolId = process.env.COGNITO_USER_POOL_ID;
    const clientId = process.env.COGNITO_APP_CLIENT_ID;
    if (!userPoolId || !clientId) {
      throw new Error(
        'COGNITO_USER_POOL_ID and COGNITO_APP_CLIENT_ID are required when AUTH_MODE is not "local". Set AUTH_MODE=local for local dev instead.'
      );
    }
    verifier = CognitoJwtVerifier.create({ userPoolId, tokenUse: 'id', clientId });
  }
  return verifier;
}

interface LocalTokenPayload {
  sub: string;
  email_verified: boolean;
  // Not read by requireAuth (which only ever trusts the DB row `sub`
  // resolves to) — carried through purely so the web app can show who's
  // signed in without a second round trip, the way a real id token's
  // `email` claim would.
  email?: string;
}

// Deliberately not a JWT — no signature to check means no library to
// misconfigure into skipping verification. It's a base64url JSON blob, only
// ever produced by POST /auth/local-login and only ever accepted when
// AUTH_MODE=local (which, per the guard above, cannot be true in
// production), so there's nothing here for a real token to be confused
// with or downgraded to.
export function encodeLocalToken(payload: LocalTokenPayload): string {
  return 'local.' + Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodeLocalToken(token: string): LocalTokenPayload | null {
  if (!token.startsWith('local.')) return null;
  try {
    const decoded = JSON.parse(Buffer.from(token.slice('local.'.length), 'base64url').toString('utf8'));
    if (typeof decoded.sub !== 'string') return null;
    return {
      sub: decoded.sub,
      email_verified: decoded.email_verified === true,
      email: typeof decoded.email === 'string' ? decoded.email : undefined,
    };
  } catch {
    return null;
  }
}

export interface AuthenticatedRequest extends Request {
  tenantId?: string;
  userEmail?: string;
  userRole?: string;
}

// Roles, from least to most privileged. Kept here instead of scattered
// across route handlers so "does role X outrank role Y" is answered in
// one place.
const ROLE_RANK: Record<string, number> = {
  read_only: 0,
  staff: 1,
  owner: 2,
};

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  let sub: string;
  let emailVerified: boolean;

  if (AUTH_MODE === 'local') {
    const decoded = decodeLocalToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    sub = decoded.sub;
    emailVerified = decoded.email_verified;
  } else {
    try {
      const payload = await getVerifier().verify(token);
      sub = payload.sub;
      // custom:tenant_id used to be read straight off the JWT and trusted.
      // That claim is user-writable (or was, before write_attributes and
      // allow_admin_create_user_only locked it down) — a valid, freshly
      // signed token proves who someone authenticated as, not which tenant
      // they belong to. Looking that up from our own `users` table by email
      // closed that hole but opened a narrower one: email was still in
      // write_attributes, and POST /team only ever created a database row,
      // never the matching Cognito user — so a user from another tenant
      // could change their own Cognito email to an email a victim tenant had
      // just added to /team but who hadn't signed in yet, and land in the
      // victim's tenant on their next token. `sub` is Cognito's immutable
      // subject claim; nothing after account creation can change which row
      // it resolves to.
      emailVerified = payload.email_verified === true;
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  if (!emailVerified) {
    return res.status(403).json({ error: 'Email must be verified' });
  }

  const user = await prisma.user.findUnique({ where: { cognitoSub: sub } });

  if (!user) {
    return res.status(403).json({ error: 'No account provisioned for this user' });
  }

  req.tenantId = user.tenantId;
  req.userEmail = user.email;
  req.userRole = user.role;
  next();
}

export async function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (AUTH_MODE === 'local') {
    return res.status(403).json({ error: 'Super admin access is not available in AUTH_MODE=local' });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await getVerifier().verify(token);
    const groups = (payload['cognito:groups'] as string[] | undefined) ?? [];

    if (!groups.includes('super-admin')) {
      return res.status(403).json({ error: 'Super admin access required' });
    }

    req.userEmail = payload.email as string;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Route-level authorization on top of requireAuth. Roles are stored in our
// own `users` table (see requireAuth) and were previously never checked —
// any authenticated user, including read_only, could hit any mutating
// route. Use as: app.post('/team', requireAuth, requireRole('owner'), ...)
export function requireRole(...allowed: string[]) {
  const minRank = Math.min(...allowed.map((r) => ROLE_RANK[r] ?? 0));

  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const rank = ROLE_RANK[req.userRole ?? 'read_only'] ?? 0;

    if (rank < minRank) {
      return res.status(403).json({ error: `This action requires one of: ${allowed.join(', ')}` });
    }

    next();
  };
}
