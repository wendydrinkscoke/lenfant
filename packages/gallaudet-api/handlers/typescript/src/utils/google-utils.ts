export const extractGoogleUserIdFromUsername = (username?: string | null): string | null => {
  if (!username) {
    return null;
  }
  const trimmed = username.trim();
  if (!trimmed) {
    return null;
  }
  const googlePrefix = 'Google_';
  if (trimmed.startsWith(googlePrefix) && trimmed.length > googlePrefix.length) {
    return trimmed.slice(googlePrefix.length);
  }
  return null;
};
