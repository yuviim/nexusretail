const COGNITO_ENDPOINT = `https://cognito-idp.${import.meta.env.VITE_COGNITO_REGION}.amazonaws.com/`;
const CLIENT_ID = import.meta.env.VITE_COGNITO_APP_CLIENT_ID;
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const AUTH_MODE = import.meta.env.VITE_AUTH_MODE || 'cognito';

interface AuthResult {
  IdToken: string;
  AccessToken: string;
  RefreshToken: string;
  ExpiresIn: number;
}

async function cognitoRequest(target: string, body: object) {
  const res = await fetch(COGNITO_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${target}`,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.__type || 'Authentication failed');
  }
  return data;
}

// AUTH_MODE=local: no real Cognito to sign in against, so the password
// field is ignored (see Login.tsx) and this just asks the API for a local
// dev token for that email — see POST /auth/local-login and
// middleware/auth.ts on the API side for why that's safe to have around
// (it doesn't exist as a route at all outside AUTH_MODE=local, which is
// itself refused under NODE_ENV=production).
async function localSignIn(email: string): Promise<AuthResult> {
  const res = await fetch(`${API_BASE_URL}/auth/local-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Sign in failed');
  }
  return { IdToken: data.token, AccessToken: data.token, RefreshToken: '', ExpiresIn: 0 };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const result =
    AUTH_MODE === 'local'
      ? await localSignIn(email)
      : (
          await cognitoRequest('InitiateAuth', {
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: CLIENT_ID,
            AuthParameters: { USERNAME: email, PASSWORD: password },
          })
        ).AuthenticationResult;

  localStorage.setItem('nexusretail_id_token', result.IdToken);
  localStorage.setItem('nexusretail_access_token', result.AccessToken);
  localStorage.setItem('nexusretail_refresh_token', result.RefreshToken);
  return result;
}

export function signOut() {
  localStorage.removeItem('nexusretail_id_token');
  localStorage.removeItem('nexusretail_access_token');
  localStorage.removeItem('nexusretail_refresh_token');
}

export function getIdToken(): string | null {
  return localStorage.getItem('nexusretail_id_token');
}

export function isAuthenticated(): boolean {
  return !!getIdToken();
}

// A real id token is three base64url segments (header.payload.signature); a
// local dev token is 'local.' followed by one base64url JSON blob (see
// middleware/auth.ts's encodeLocalToken on the API side) — never a valid
// three-segment JWT, so there's no ambiguity between the two shapes.
function decodeTokenPayload(token: string): Record<string, unknown> | null {
  try {
    if (token.startsWith('local.')) {
      return JSON.parse(atob(token.slice('local.'.length)));
    }
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

export function getUserEmail(): string | null {
  const token = getIdToken();
  if (!token) return null;
  const payload = decodeTokenPayload(token);
  return (payload?.email as string) || null;
}

export function isSuperAdmin(): boolean {
  const token = getIdToken();
  if (!token) return false;
  const payload = decodeTokenPayload(token);
  const groups = payload?.['cognito:groups'] as string[] | undefined;
  return groups?.includes('super-admin') ?? false;
}
