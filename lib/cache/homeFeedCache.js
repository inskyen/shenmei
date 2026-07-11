let cachedHomeFeed = null;

export function getCachedHomeFeed() {
  return cachedHomeFeed;
}

export function cacheHomeFeed(items) {
  cachedHomeFeed = items || [];
}
