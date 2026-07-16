import { supabase } from '@/lib/supabase/client';

export async function loadLikedPostIds(postIds) {
  const uniquePostIds = [...new Set(postIds.filter(Boolean))];

  if (uniquePostIds.length === 0) {
    return new Set();
  }

  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError || !userResult?.user) {
    return new Set();
  }

  const { data, error } = await supabase
    .from('reactions')
    .select('target_id')
    .eq('user_id', userResult.user.id)
    .eq('target_type', 'post')
    .eq('reaction_type', 'like')
    .in('target_id', uniquePostIds);

  if (error) {
    throw error;
  }

  return new Set((data || []).map((reaction) => reaction.target_id));
}

export async function togglePostLike(postId) {
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError) {
    if (userError.name === 'AuthSessionMissingError' || userError.message.includes('session missing')) {
      return { requiresLogin: true };
    }
    throw userError;
  }

  if (!userResult?.user) {
    return { requiresLogin: true };
  }

  const userId = userResult.user.id;
  const { data: existingReaction, error: existingError } = await supabase
    .from('reactions')
    .select('id')
    .eq('user_id', userId)
    .eq('target_type', 'post')
    .eq('target_id', postId)
    .eq('reaction_type', 'like')
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existingReaction) {
    const { error: deleteError } = await supabase
      .from('reactions')
      .delete()
      .eq('id', existingReaction.id)
      .eq('user_id', userId);

    if (deleteError) {
      throw deleteError;
    }

    return { liked: false, delta: -1 };
  }

  const { error: insertError } = await supabase
    .from('reactions')
    .insert({
      user_id: userId,
      target_type: 'post',
      target_id: postId,
      reaction_type: 'like',
    });

  if (insertError) {
    throw insertError;
  }

  return { liked: true, delta: 1 };
}
