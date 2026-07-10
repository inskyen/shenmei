import { getCurrentUser } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';

async function countFollows(column, profileId) {
  const { count, error } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq(column, profileId);

  if (error) {
    throw error;
  }

  return count || 0;
}

export async function loadProfileFollowState(profileId) {
  const currentUser = await getCurrentUser();
  const isOwnProfile = currentUser?.id === profileId;

  const [followerCount, followingCount, followResult] = await Promise.all([
    countFollows('following_id', profileId),
    countFollows('follower_id', profileId),
    currentUser && !isOwnProfile
      ? supabase
        .from('follows')
        .select('id')
        .eq('follower_id', currentUser.id)
        .eq('following_id', profileId)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (followResult.error) {
    throw followResult.error;
  }

  return {
    followerCount,
    followingCount,
    isFollowing: Boolean(followResult.data),
  };
}

export async function toggleProfileFollow(profileId) {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { requiresLogin: true };
  }

  if (currentUser.id === profileId) {
    return { isOwnProfile: true };
  }

  const { data: existingFollow, error: existingFollowError } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', currentUser.id)
    .eq('following_id', profileId)
    .maybeSingle();

  if (existingFollowError) {
    throw existingFollowError;
  }

  if (existingFollow) {
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('id', existingFollow.id);

    if (error) {
      throw error;
    }

    return { isFollowing: false };
  }

  const { error } = await supabase
    .from('follows')
    .insert({
      follower_id: currentUser.id,
      following_id: profileId,
    });

  if (error) {
    throw error;
  }

  return { isFollowing: true };
}

export async function loadFollowedProfiles() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { requiresLogin: true, profiles: [] };
  }

  const { data: follows, error: followsError } = await supabase
    .from('follows')
    .select('following_id, created_at')
    .eq('follower_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (followsError) {
    throw followsError;
  }

  const profileIds = (follows || []).map((follow) => follow.following_id);
  if (profileIds.length === 0) {
    return { requiresLogin: false, profiles: [] };
  }

  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, bio, aesthetic_tags')
    .in('id', profileIds);

  if (profilesError) {
    throw profilesError;
  }

  const profilesById = (profiles || []).reduce((result, profile) => {
    result[profile.id] = profile;
    return result;
  }, {});

  return {
    requiresLogin: false,
    profiles: profileIds.map((profileId) => profilesById[profileId]).filter(Boolean),
  };
}

export async function loadFollowingFeed() {
  const followedProfiles = await loadFollowedProfiles();
  if (followedProfiles.requiresLogin || followedProfiles.profiles.length === 0) {
    return { ...followedProfiles, posts: [] };
  }

  const profileIds = followedProfiles.profiles.map((profile) => profile.id);
  const profilesById = indexProfiles(followedProfiles.profiles);

  const { data: posts, error } = await supabase
    .from('posts')
    .select(`
      id,
      user_id,
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
    .in('user_id', profileIds)
    .eq('status', 'published')
    .eq('visibility', 'public')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return {
    requiresLogin: false,
    profiles: followedProfiles.profiles,
    posts: (posts || []).map((post) => ({
      ...post,
      profile: profilesById[post.user_id] || null,
    })),
  };
}
