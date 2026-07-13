import { supabase } from '@/lib/supabase/client';

export const USER_ROLES = {
  MEMBER: 'member',
  AESTHETE: 'aesthete',
  SUPER_ADMIN: 'super_admin',
};

export function canCurateInModules(role) {
  return role === USER_ROLES.AESTHETE || role === USER_ROLES.SUPER_ADMIN;
}

export async function loadProfileRole(userId) {
  if (!userId) return USER_ROLES.MEMBER;

  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data?.role || USER_ROLES.MEMBER;
}
