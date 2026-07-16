import { supabase } from '@/lib/supabase/client';
import { loadProfileFollowState } from '@/lib/follows/profileFollows';

const profilePageCache = new Map();
export const PROFILE_POST_PAGE_SIZE = 8;

const PROFILE_POST_SELECT = `
  id,
  note,
  created_at,
  like_count,
  comment_count,
  videos (
    id,
    external_id,
    title,
    cover_url,
    author_name
  )
`;

export function getCachedProfilePage(username) {
  return profilePageCache.get(username) || null;
}

export function clearProfilePageCache() {
  profilePageCache.clear();
}

export function adjustProfilePostCommentCount(postId, delta) {
  profilePageCache.forEach((page, username) => {
    profilePageCache.set(username, {
      ...page,
      posts: (page.posts || []).map((post) => (
        post.id === postId
          ? { ...post, comment_count: Math.max(0, (post.comment_count || 0) + delta) }
          : post
      )),
    });
  });
}

export function cacheProfilePage(profile, posts, options = {}) {
  if (!profile?.username) return;

  const cachedPage = profilePageCache.get(profile.username);

  profilePageCache.set(profile.username, {
    profile,
    posts: posts || [],
    hasMore: options.hasMore ?? false,
    nextOffset: options.nextOffset ?? (posts?.length || 0),
    totalPostCount: options.totalPostCount ?? (posts?.length || 0),
    totalLikeCount: options.totalLikeCount
      ?? cachedPage?.totalLikeCount
      ?? (posts || []).reduce((sum, post) => sum + (post.like_count || 0), 0),
    followerCount: options.followerCount ?? cachedPage?.followerCount,
    followingCount: options.followingCount ?? cachedPage?.followingCount,
  });
}

export async function loadProfileLikeCount(profileId) {
  const { data, error } = await supabase
    .from('posts')
    .select('like_count')
    .eq('user_id', profileId)
    .eq('status', 'published')
    .eq('visibility', 'public');

  if (error) throw error;

  return (data || []).reduce((sum, post) => sum + (post.like_count || 0), 0);
}

export async function loadProfilePostsPage(profileId, offset = 0) {
  const { data, error, count } = await supabase
    .from('posts')
    .select(PROFILE_POST_SELECT, { count: 'exact' })
    .eq('user_id', profileId)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false })
    .range(offset, offset + PROFILE_POST_PAGE_SIZE);

  if (error) throw error;

  const rows = data || [];
  const posts = rows.slice(0, PROFILE_POST_PAGE_SIZE);
  const totalPostCount = count ?? (offset + posts.length);

  return {
    posts,
    hasMore: rows.length > PROFILE_POST_PAGE_SIZE || (offset + posts.length) < totalPostCount,
    nextOffset: offset + posts.length,
    totalPostCount,
  };
}

export async function prefetchProfilePage(profile) {
  if (!profile?.id || !profile.username) return;

  const [page, totalLikeCount, followState] = await Promise.all([
    loadProfilePostsPage(profile.id, 0),
    loadProfileLikeCount(profile.id),
    loadProfileFollowState(profile.id).catch(() => null),
  ]);
  cacheProfilePage(profile, page.posts, { 
    ...page, 
    totalLikeCount, 
    followerCount: followState?.followerCount, 
    followingCount: followState?.followingCount 
  });
}
