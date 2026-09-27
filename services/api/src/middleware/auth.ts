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
    const email = payload.email as string | undefined;

    if (!email) {
      return res.status(403).json({ error: 'Token has no email claim' });
    }

    // custom:tenant_id used to be read straight off the JWT and trusted.
    // That claim is user-writable (or was, before write_attributes and
    // allow_admin_create_user_only locked it down) — a valid, freshly
    // signed token proves who someone authenticated as, not which tenant
    // they belong to. Tenant membership is looked up here from our own
    // `users` table instead, keyed on the verified email, so a token can no
    // longer assert its way into another tenant's data.
    const user = await prisma.user.findUnique({ where: { email } });

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
