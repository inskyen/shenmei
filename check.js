const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ylrmyuczysjwsgiizvzk.supabase.co',
  'sb_publishable_nSe5ZQTap3KqfZApF7hTTA_AHc3v4iP'
);

async function check() {
  const { data, error } = await supabase.from('comments').select('*');
  console.log('Comments:', JSON.stringify(data, null, 2));
  if (error) console.error('Error:', error);
}

check();
