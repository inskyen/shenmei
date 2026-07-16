import { loadFollowingFeed } from '@/lib/follows/profileFollows';

let followingFeedCache = null;

export function getCachedFollowingFeed() {
  return followingFeedCache;
}

export function cacheFollowingFeed(feed) {
  followingFeedCache = feed || null;
}

export function clearFollowingFeedCache() {
  followingFeedCache = null;
}

export function adjustFollowingPostCommentCount(postId, delta) {
  if (!followingFeedCache?.posts) return;

  followingFeedCache = {
    ...followingFeedCache,
    posts: followingFeedCache.posts.map((post) => (
      post.id === postId
        ? { ...post, comment_count: Math.max(0, (post.comment_count || 0) + delta) }
        : post
    )),
  };
}

export async function prefetchFollowingFeed({ force = false } = {}) {
  if (!force && followingFeedCache) return followingFeedCache;
  const feed = await loadFollowingFeed();
  cacheFollowingFeed(feed);
  return feed;
}
