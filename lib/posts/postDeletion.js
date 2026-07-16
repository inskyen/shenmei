import { getCurrentUser } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';

export async function deletePost(postId) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return { requiresLogin: true };

  const { data: deleted, error } = await supabase
    .rpc('soft_delete_post', { target_post_id: postId });

  if (error) throw error;
  if (!deleted) throw new Error('您沒有權限刪除這條採樣，或內容已被移除。');

  return { requiresLogin: false };
}
