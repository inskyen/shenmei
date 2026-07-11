import { supabase } from '@/lib/supabase/client';

const profilePageCache = new Map();

export function getCachedProfilePage(username) {
  return profilePageCache.get(username) || null;
}

export function cacheProfilePage(profile, posts) {
  if (!profile?.username) return;

  profilePageCache.set(profile.username, {
    profile,
    posts: posts || [],
  });
}

export async function prefetchProfilePage(profile) {
  if (!profile?.id || !profile.username) return;

  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
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
    `)
    .eq('user_id', profile.id)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  if (error) throw error;

  cacheProfilePage(profile, posts);
}
