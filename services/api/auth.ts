import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { Request, Response, NextFunction } from 'express';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'id',
  clientId: process.env.COGNITO_APP_CLIENT_ID!,
});

export interface AuthenticatedRequest extends Request {
  tenantId?: string;
  userEmail?: string;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifier.verify(token);
    const tenantId = payload['custom:tenant_id'] as string | undefined;

    if (!tenantId) {
      return res.status(403).json({ error: 'User has no associated tenant' });
    }

    req.tenantId = tenantId;
    req.userEmail = payload.email as string;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
