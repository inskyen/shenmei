const postDetailCache = new Map();

export function cachePostPreview(feedItem) {
  if (!feedItem?.post_id) return;

  postDetailCache.set(feedItem.post_id, {
    post: {
      id: feedItem.post_id,
      user_id: feedItem.user_id || null,
      legacy_added_by: feedItem.legacy_added_by || feedItem.added_by || null,
      note: feedItem.title || '',
      created_at: feedItem.created_at,
      like_count: feedItem.play_count || 0,
      comment_count: feedItem.comment_count || 0,
      videos: {
        id: feedItem.video_id || feedItem.id,
        external_id: feedItem.bvid,
        title: feedItem.video_title,
        cover_url: feedItem.cover,
        author_name: feedItem.up_name,
      },
    },
    profile: feedItem.profile_username
      ? {
        id: feedItem.profile_id || null,
        username: feedItem.profile_username,
        avatar_url: feedItem.profile_avatar_url || null,
      }
      : null,
  });
}

export function cachePostDetail(post, profile) {
  if (!post?.id) return;

  postDetailCache.set(post.id, { post, profile: profile || null });
}

export function getCachedPostDetail(postId) {
  return postDetailCache.get(postId) || null;
}
