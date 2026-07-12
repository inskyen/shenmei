import { getCurrentUser } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';

function indexProfiles(profiles) {
  return (profiles || []).reduce((result, profile) => {
    result[profile.id] = profile;
    return result;
  }, {});
}

export async function loadUnreadNotificationCount() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return 0;

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_id', currentUser.id)
    .eq('is_read', false);

  if (error) throw error;

  return count || 0;
}

export async function loadNotifications() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { requiresLogin: true, notifications: [] };
  }

  const { data: rows, error } = await supabase
    .from('notifications')
    .select('id, actor_id, type, post_id, conversation_id, created_at, is_read')
    .eq('recipient_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  const actorIds = [...new Set((rows || []).map((row) => row.actor_id).filter(Boolean))];
  if (actorIds.length === 0) {
    return { requiresLogin: false, notifications: rows || [] };
  }

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', actorIds);

  if (profileError) throw profileError;

  const profilesById = indexProfiles(profiles);

  return {
    requiresLogin: false,
    notifications: (rows || []).map((notification) => ({
      ...notification,
      actor: profilesById[notification.actor_id] || null,
    })),
  };
}

export async function markNotificationsRead() {
  const currentUser = await getCurrentUser();
  if (!currentUser) return;

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('recipient_id', currentUser.id)
    .eq('is_read', false);

  if (error) throw error;
}
