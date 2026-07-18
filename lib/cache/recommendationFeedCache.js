let cachedRecommendationFeed = null;
const STORAGE_KEY = 'shenmei:recommendation-feed-snapshot';
const SNAPSHOT_MAX_AGE = 6 * 60 * 60 * 1000;
const SNAPSHOT_ITEM_LIMIT = 20;

function readRecommendationSnapshot() {
  if (typeof window === 'undefined') return null;

  try {
    const snapshot = JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (!snapshot?.items?.length || Date.now() - snapshot.savedAt > SNAPSHOT_MAX_AGE) {
      window.sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

function saveRecommendationSnapshot(feed) {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...feed,
      items: feed.items.slice(0, SNAPSHOT_ITEM_LIMIT),
      savedAt: Date.now(),
    }));
  } catch {
    // 隱私模式或儲存空間不足時，保留原本的記憶體快取即可。
  }
}

export function getCachedRecommendationFeed() {
  return cachedRecommendationFeed;
}

export function getPersistedRecommendationFeed() {
  return readRecommendationSnapshot();
}

export function cacheRecommendationFeed(items, metadata = {}) {
  cachedRecommendationFeed = {
    items: items || [],
    hasMore: metadata.hasMore ?? true,
    seed: metadata.seed || null,
    sessionId: metadata.sessionId || null,
  };
  saveRecommendationSnapshot(cachedRecommendationFeed);
}

export function clearRecommendationFeedCache() {
  cachedRecommendationFeed = null;
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem(STORAGE_KEY);
  }
}

export function adjustRecommendationLikeCount(postId, delta) {
  if (!cachedRecommendationFeed) return;

  cachedRecommendationFeed = {
    ...cachedRecommendationFeed,
    items: cachedRecommendationFeed.items.map((item) => (
      item.post_id === postId
        ? { ...item, play_count: Math.max(0, (item.play_count || 0) + delta) }
        : item
    )),
  };
  saveRecommendationSnapshot(cachedRecommendationFeed);
}
