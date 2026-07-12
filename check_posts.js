const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ylrmyuczysjwsgiizvzk.supabase.co',
  'sb_publishable_nSe5ZQTap3KqfZApF7hTTA_AHc3v4iP'
);

async function check() {
  const { data, error } = await supabase.from('posts').select('id, comment_count');
  console.log('Posts:', JSON.stringify(data, null, 2));
}

check();
