const COGNITO_ENDPOINT = `https://cognito-idp.${import.meta.env.VITE_COGNITO_REGION}.amazonaws.com/`;
const CLIENT_ID = import.meta.env.VITE_COGNITO_APP_CLIENT_ID;

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

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const data = await cognitoRequest('InitiateAuth', {
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });

  const result = data.AuthenticationResult;
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

export function getUserEmail(): string | null {
  const token = getIdToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.email || null;
  } catch {
    return null;
  }
}

export function isSuperAdmin(): boolean {
  const token = getIdToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const groups = payload['cognito:groups'] as string[] | undefined;
    return groups?.includes('super-admin') ?? false;
  } catch {
    return false;
  }
}
