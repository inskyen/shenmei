import { supabase } from '@/lib/supabase/client';
import { mapPostToFeedItem } from '@/lib/feed/mapPostToFeedItem';

// 大廳最新流的過渡接口。
// 目前資料庫已經有 posts + videos 雙核心，但首頁 UI 還沿用舊的 video 卡片結構。
// 這裡先把 post + video 組合成首頁容易消費的形狀，等元件拆分後再改成更正式的資料模型。
export default async function handler(req, res) {
  try {
    // 首页每次只取一小批，额外多取一条用来判断后面是否还有数据。
    // limit 设上限可避免客户端误传大数值时重新退化成一次拉取全部。
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const requestedOffset = Number.parseInt(req.query.offset, 10);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10, 1), 20);
    const offset = Math.max(Number.isFinite(requestedOffset) ? requestedOffset : 0, 0);

    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        user_id,
        note,
        created_at,
        legacy_added_by,
        like_count,
        comment_count,
        profiles (
          id,
          username,
          display_name,
          avatar_url,
          role
        ),
        videos (
          id,
          external_id,
          title,
          cover_url,
          author_name,
          play_count,
          fav_time
        )
      `)
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit);

    if (error) {
      throw error;
    }

    const pageRows = (data || []).slice(0, limit);
    const items = pageRows.map(mapPostToFeedItem);

    res.status(200).json({
      items,
      has_more: (data || []).length > limit,
      next_offset: offset + items.length,
    });
  } catch (err) {
    console.error('大廳資料載入錯誤:', err);
    res.status(500).json({ error: '大廳資料載入失敗' });
  }
}
