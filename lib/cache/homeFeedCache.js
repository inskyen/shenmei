let cachedHomeFeed = null;

export function getCachedHomeFeed() {
  return cachedHomeFeed;
}

export function cacheHomeFeed(items, pagination = {}) {
  const nextItems = items || [];

  cachedHomeFeed = {
    items: nextItems,
    hasMore: pagination.hasMore ?? true,
    nextOffset: pagination.nextOffset ?? nextItems.length,
  };
}
