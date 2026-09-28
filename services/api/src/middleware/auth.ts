import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'id',
  clientId: process.env.COGNITO_APP_CLIENT_ID!,
});

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

  try {
    const payload = await verifier.verify(token);
    const sub = payload.sub;

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
    if (payload.email_verified !== true) {
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
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifier.verify(token);
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
