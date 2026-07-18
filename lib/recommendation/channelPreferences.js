import { supabase } from '@/lib/supabase/client';

export const CHANNEL_PREFERENCE_OPTIONS = [
  { value: -2, label: '不推薦' },
  { value: -1, label: '少一點' },
  { value: 0, label: '正常' },
  { value: 2, label: '多一點' },
];

export async function loadChannelPreference(userId, moduleId) {
  if (!userId || !moduleId) return 0;

  const { data, error } = await supabase
    .from('user_channel_preferences')
    .select('preference')
    .eq('user_id', userId)
    .eq('module_id', moduleId)
    .maybeSingle();

  if (error) throw error;
  return data?.preference ?? 0;
}

export async function saveChannelPreference(userId, moduleId, preference) {
  const option = CHANNEL_PREFERENCE_OPTIONS.find((item) => item.value === preference);
  if (!option) throw new Error('無效的推薦強度。');

  const { error } = await supabase
    .from('user_channel_preferences')
    .upsert(
      { user_id: userId, module_id: moduleId, preference },
      { onConflict: 'user_id,module_id' }
    );

  if (error) throw error;
  return preference;
}
