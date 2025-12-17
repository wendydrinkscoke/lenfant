import { CognitoIdentityServiceProvider } from 'aws-sdk';

export type RobloxIdTokenClaims = {
  sub?: string;
  iss?: string;
  exp?: number;
  aud?: string;
  token_use?: string;
  ['custom:robloxUserId']?: string;
};

export const base64UrlDecode = (segment: string): string => {
  const padded = segment.padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=');
  const normalized = padded.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized, 'base64').toString('utf8');
};

export const decodeRobloxIdToken = (token: string): RobloxIdTokenClaims => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  try {
    const payload = base64UrlDecode(parts[1]);
    return JSON.parse(payload);
  } catch (err) {
    throw new Error(`Failed to decode robloxIdToken: ${(err as Error).message}`);
  }
};

export const extractRobloxUserId = (
  attributes: CognitoIdentityServiceProvider.AttributeListType | undefined,
): string | undefined =>
  attributes?.find((attr) => attr.Name === 'custom:robloxUserId')?.Value;

export const parseIdentitiesClaim = (
  claim: unknown,
): Array<{ providerName?: string; userId?: string }> => {
  if (!claim) return [];
  if (Array.isArray(claim)) return claim;
  if (typeof claim === 'string') {
    try {
      const parsed = JSON.parse(claim);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const getRobloxUserNameFromUserId = async (userId: string, apiKeyValue: string): Promise<string> => {
  const robloxUsersEndpoint = `https://users.roblox.com/v1/users/${userId}`;

  const response = await fetch(robloxUsersEndpoint, {
    headers: {
      'x-api-key': apiKeyValue,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user data: ${response.status}`);
  }

  const userData = await response.json();
  return userData.name;
};