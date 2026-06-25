import { createClient } from '@supabase/supabase-js';

// 从环境变量中读取配置并初始化 Supabase 客户端
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  try {
    // 从 videos 表中查询所有字段，并按照创建时间（created_at）倒序排列
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    // 返回给前端的结构保持不变
    res.status(200).json({ videos: data });
    
  } catch (err) {
    console.error('Supabase 查询错误:', err);
    res.status(500).json({ error: '数据加载失败' });
  }
}