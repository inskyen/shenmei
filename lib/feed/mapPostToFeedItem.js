export function mapPostToFeedItem(post) {
  const video = post.videos || {};
  const profile = post.profiles || {};

  return {
    post_id: post.id,
    user_id: post.user_id,
    id: video.id,
    video_id: video.id,
    bvid: video.external_id,
    title: post.note,
    video_title: video.title,
    cover: video.cover_url,
    up_name: video.author_name,
    added_by: profile.display_name || profile.username || post.legacy_added_by || '採樣人',
    legacy_added_by: post.legacy_added_by || null,
    profile_username: profile.username || null,
    profile_id: profile.id || null,
    profile_avatar_url: profile.avatar_url || null,
    profile_role: profile.role || 'member',
    created_at: post.created_at,
    fav_time: post.created_at,
    play_count: post.like_count,
    comment_count: post.comment_count,
    recommendation_reason: post.recommendation?.reason_label || null,
    recommendation_reason_code: post.recommendation?.reason_code || null,
    recommendation_channel: post.recommendation?.channel || null,
  };
}
