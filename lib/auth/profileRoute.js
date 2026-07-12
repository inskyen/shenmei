function getStorageKey(userId) {
  return `shenmei:profile-username:${userId}`;
}

export function cacheProfileRoute(userId, username) {
  if (typeof window === 'undefined' || !userId || !username) return;
  window.localStorage.setItem(getStorageKey(userId), username);
}

export function getCachedProfilePath(userId) {
  if (typeof window === 'undefined' || !userId) return null;
  const username = window.localStorage.getItem(getStorageKey(userId));
  return username ? `/u/${username}` : null;
}
