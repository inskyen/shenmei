import { supabase } from '@/lib/supabase/client';

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

    // 將新資料模型映射成首頁現有卡片能直接使用的欄位。
    // post_id 用來進入 /p/[id]，id/video_id 用來進入 /v/[id]。
    const pageRows = (data || []).slice(0, limit);
    const items = pageRows.map((post) => {
      const video = post.videos || {};
      const profile = post.profiles || {};

      return {
        post_id: post.id,
        user_id: post.user_id,
        id: video.id,
        video_id: video.id,
        bvid: video.external_id,
        title: post.note,
        video_title: video.title,
        cover: video.cover_url,
        up_name: video.author_name,
        added_by: profile.display_name || profile.username || post.legacy_added_by || '策展人',
        legacy_added_by: post.legacy_added_by || null,
        profile_username: profile.username || null,
        profile_id: profile.id || null,
        profile_avatar_url: profile.avatar_url || null,
        profile_role: profile.role || 'member',
        created_at: post.created_at,
        fav_time: video.fav_time,
        play_count: post.like_count,
        comment_count: post.comment_count,
      };
    });

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
