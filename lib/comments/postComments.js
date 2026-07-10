import { getCurrentUser } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';

function indexProfiles(profiles) {
  return (profiles || []).reduce((result, profile) => {
    result[profile.id] = profile;
    return result;
  }, {});
}

export async function loadPostComments(postId) {
  const { data: commentRows, error: commentError } = await supabase
    .from('comments')
    .select('id, user_id, content, created_at')
    .eq('target_type', 'post')
    .eq('post_id', postId)
    .eq('status', 'published')
    .order('created_at', { ascending: false });

  if (commentError) {
    throw commentError;
  }

  const profileIds = [...new Set((commentRows || []).map((comment) => comment.user_id).filter(Boolean))];
  if (profileIds.length === 0) {
    return [];
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', profileIds);

  if (profileError) {
    throw profileError;
  }

  const profilesById = indexProfiles(profiles);

  return (commentRows || []).map((comment) => ({
    ...comment,
    profile: profilesById[comment.user_id] || null,
  }));
}

export async function createPostComment({ postId, content }) {
  const user = await getCurrentUser();
  if (!user) {
    return { requiresLogin: true };
  }

  const { data: comment, error: commentError } = await supabase
    .from('comments')
    .insert({
      target_type: 'post',
      post_id: postId,
      user_id: user.id,
      content: content.trim(),
      status: 'published',
    })
    .select('id, user_id, content, created_at')
    .single();

  if (commentError) {
    throw commentError;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  return {
    comment: {
      ...comment,
      profile: profile || null,
    },
  };
}
