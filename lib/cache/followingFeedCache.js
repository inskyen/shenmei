import { loadFollowingFeed } from '@/lib/follows/profileFollows';

let followingFeedCache = null;

export function getCachedFollowingFeed() {
  return followingFeedCache;
}

export function cacheFollowingFeed(feed) {
  followingFeedCache = feed || null;
}

function mergeFollowingFeed(currentFeed, nextPage) {
  const postsById = new Map();
  [...(currentFeed?.posts || []), ...(nextPage?.posts || [])].forEach((post) => {
    if (post?.id && !postsById.has(post.id)) postsById.set(post.id, post);
  });

  return {
    ...currentFeed,
    ...nextPage,
    profiles: nextPage?.profiles?.length ? nextPage.profiles : (currentFeed?.profiles || []),
    posts: [...postsById.values()],
  };
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

export async function prefetchFollowingFeed({ force = false, offset = 0 } = {}) {
  if (!force && offset === 0 && followingFeedCache) return followingFeedCache;

  const page = await loadFollowingFeed({ offset });
  const feed = offset > 0
    ? mergeFollowingFeed(followingFeedCache, page)
    : page;
  cacheFollowingFeed(feed);
  return feed;
}
