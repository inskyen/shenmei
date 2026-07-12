import { loadFollowingFeed } from '@/lib/follows/profileFollows';

let followingFeedCache = null;

export function getCachedFollowingFeed() {
  return followingFeedCache;
}

export function cacheFollowingFeed(feed) {
  followingFeedCache = feed || null;
}

export async function prefetchFollowingFeed({ force = false } = {}) {
  if (!force && followingFeedCache) return followingFeedCache;
  const feed = await loadFollowingFeed();
  cacheFollowingFeed(feed);
  return feed;
}
