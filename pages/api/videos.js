import { supabase } from '@/lib/supabase/client';

export default async function handler(req, res) {
  try {
    // 過渡接口：目前首頁仍讀舊的 videos 表。
    // 正式 MVP 會把首頁資料源切到 posts，再連帶 video/profile/module 資料。
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // 返回給前端的結構暫時保持不變，避免第一步地基整理影響現有首頁。
    res.status(200).json({ videos: data });
    
  } catch (err) {
    console.error('Supabase 查詢錯誤:', err);
    res.status(500).json({ error: '資料載入失敗' });
  }
}
