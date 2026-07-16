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

export function removePostFromHomeFeed(postId) {
  if (!cachedHomeFeed) return;

  if (Array.isArray(cachedHomeFeed)) {
    cachedHomeFeed = cachedHomeFeed.filter((item) => item.post_id !== postId);
    return;
  }

  cachedHomeFeed = {
    ...cachedHomeFeed,
    items: (cachedHomeFeed.items || []).filter((item) => item.post_id !== postId),
  };
}

export function adjustHomeFeedPostCommentCount(postId, delta) {
  if (!cachedHomeFeed) return;

  const adjustItems = (items) => (items || []).map((item) => (
    item.post_id === postId
      ? { ...item, comment_count: Math.max(0, (item.comment_count || 0) + delta) }
      : item
  ));

  if (Array.isArray(cachedHomeFeed)) {
    cachedHomeFeed = adjustItems(cachedHomeFeed);
    return;
  }

  cachedHomeFeed = { ...cachedHomeFeed, items: adjustItems(cachedHomeFeed.items) };
}
