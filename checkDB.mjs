import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { data: allComments, error: err1 } = await supabase.from('comments').select('id, target_type, post_id, status');
  console.log('All comments:', allComments);
  
  if (err1) {
    console.error('Error fetching comments:', err1);
  }
}

test();
