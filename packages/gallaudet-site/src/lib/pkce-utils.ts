// PKCE utility for Cognito OAuth
export function generateCodeVerifier(length = 64) {
  const array = new Uint8Array(length);
  window.crypto.getRandomValues(array);
  // base62 charset
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  return Array.from(array).map(b => charset[b % charset.length]).join('');
}

export async function generateCodeChallenge(codeVerifier: string) {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  // Convert digest to base64-url string without using spread operator
  const uint8Arr = new Uint8Array(digest);
  let str = '';
  for (let i = 0; i < uint8Arr.length; i++) {
    str += String.fromCharCode(uint8Arr[i]);
  }
  const base64 = btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return base64;
}
