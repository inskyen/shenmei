import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { requireLogin } from '@/lib/auth/requireLogin';
import { loadLikedPostIds, togglePostLike } from '@/lib/reactions/postLikes';
import { supabase } from '@/lib/supabase/client';

export default function Home() {
  const router = useRouter();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [likedPostIds, setLikedPostIds] = useState(new Set());
  const [likingPostIds, setLikingPostIds] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  
  // 交互状态保留
  const [immersiveVideo, setImmersiveVideo] = useState(null);
  const [detailPageVideo, setDetailPageVideo] = useState(null);

  // 初始化加载数据
  useEffect(() => {
    // 大廳現在先讀 posts + videos 的過渡 feed。
    // API 會把新資料模型映射成首頁舊卡片能使用的欄位，避免一次重寫整個 UI。
    fetch('/api/feed')
      .then(res => res.json())
      .then(data => {
        const items = data.items || [];
        setVideos(items);
        setLoading(false);

        return loadLikedPostIds(items.map((item) => item.post_id));
      })
      .then((nextLikedPostIds) => {
        if (nextLikedPostIds) {
          setLikedPostIds(nextLikedPostIds);
        }
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });

    // 獲取當前登入使用者與其 Profile
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUser(user);
      if (user) {
        supabase
          .from('profiles')
          .select('avatar_url, username')
          .eq('id', user.id)
          .single()
          .then(({ data }) => {
            if (data) setUserProfile(data);
          });
      }
    });
  }, []);

  // 历史记录劫持：防侧滑退出魔法
  useEffect(() => {
    const handlePopState = () => {
      if (immersiveVideo) setImmersiveVideo(null);
      if (detailPageVideo) setDetailPageVideo(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [immersiveVideo, detailPageVideo]);

  const openImmersive = (video) => {
    window.history.pushState({ modal: true }, "");
    setImmersiveVideo(video);
  };

  const closeImmersive = () => {
    setImmersiveVideo(null);
    if (window.history.state && window.history.state.modal) {
      window.history.back();
    }
  };

  const openDetailPage = (video) => {
    // 有 post_id 時進入正式策展詳情頁；沒有時才退回舊的本頁浮層。
    if (video.post_id) {
      router.push(`/p/${video.post_id}`);
      return;
    }

    window.history.pushState({ modal: true }, "");
    setDetailPageVideo(video);
  };

  const openVideoPage = (video) => {
    // 影片主頁以 video 為核心，負責沉澱播放、所有推薦與公共留言。
    if (video.video_id || video.id) {
      router.push(`/v/${video.video_id || video.id}`);
    }
  };

  const openUserPage = (event, video) => {
    event.stopPropagation();

    if (video.profile_username) {
      router.push(`/u/${video.profile_username}`);
      return;
    }

    openDetailPage(video);
  };

  const goToProtectedPage = async (path, message) => {
    try {
      const user = await requireLogin({
        router,
        nextPath: path,
        message,
      });

      if (user) {
        router.push(path);
      }
    } catch (error) {
      console.error('登入狀態檢查失敗:', error);
      alert('登入狀態確認失敗，請稍後再試。');
    }
  };

  const handleToggleLike = async (event, video) => {
    event.stopPropagation();

    if (!video.post_id || likingPostIds.has(video.post_id)) {
      return;
    }

    setLikingPostIds((currentIds) => new Set(currentIds).add(video.post_id));

    try {
      const result = await togglePostLike(video.post_id);

      if (result.requiresLogin) {
        await requireLogin({
          router,
          nextPath: router.asPath,
          message: '請先登入，才能喜歡這條策展。',
        });
        return;
      }

      setLikedPostIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (result.liked) {
          nextIds.add(video.post_id);
        } else {
          nextIds.delete(video.post_id);
        }

        return nextIds;
      });

      setVideos((currentItems) => currentItems.map((item) => (
        item.post_id === video.post_id
          ? { ...item, play_count: Math.max(0, (item.play_count || 0) + result.delta) }
          : item
      )));
    } catch (error) {
      console.error('喜歡操作失敗:', error);
      alert('喜歡操作失敗，請稍後再試。');
    } finally {
      setLikingPostIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(video.post_id);
        return nextIds;
      });
    }
  };

  const closeDetailPage = () => {
    setDetailPageVideo(null);
    if (window.history.state && window.history.state.modal) {
      window.history.back();
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp.toString().length === 10 ? timestamp * 1000 : timestamp);
    const minsAgo = Math.floor((new Date() - date) / 60000);
    if (minsAgo < 60) return `${minsAgo} 分鐘前`;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    // 主背景：落雪宣白
    <div style={{ backgroundColor: '#F4F7FA', minHeight: '100vh', color: '#2A3F54', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: '100px', position: 'relative' }}>
      <Head>
        <title>審美者 · AESTHETE</title>
      </Head>

      {/* 顶部导航栏 (复刻 UI 稿) */}
      <header style={{ 
        position: 'sticky', top: 0, zIndex: 20, 
        backgroundColor: 'rgba(244, 247, 250, 0.9)', backdropFilter: 'blur(12px)',
        padding: '48px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        borderBottom: '1px solid rgba(217, 228, 245, 0.5)'
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
          <span onClick={() => router.push('/following')} style={{ color: '#87ACCA', fontSize: '18px', fontWeight: '500', cursor: 'pointer' }}>追蹤</span>
          <span style={{ color: '#2A3F54', fontSize: '24px', fontWeight: 'bold' }}>最新</span>
          <span onClick={() => router.push('/m')} style={{ color: '#87ACCA', fontSize: '18px', fontWeight: '500', cursor: 'pointer' }}>小館</span>
        </div>
        <div style={{ display: 'flex', gap: '16px', paddingBottom: '4px', alignItems: 'center' }}>
          <svg onClick={() => router.push('/search')} style={{ width: '24px', height: '24px', color: '#2A3F54', cursor: 'pointer' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>

          {currentUser ? (
            <div 
              onClick={() => router.push('/u/me')} 
              style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#6B99C3', border: '1px solid #2A527A', overflow: 'hidden', cursor: 'pointer' }}
            >
              <img src={userProfile?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${userProfile?.username || 'shenmei'}`} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <div 
              onClick={() => router.push('/login')} 
              style={{ padding: '4px 12px', borderRadius: '16px', border: '1px solid rgba(194, 214, 230, 0.8)', color: '#6B99C3', fontSize: '13px', cursor: 'pointer', backgroundColor: 'rgba(255, 255, 255, 0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              登入
            </div>
          )}
        </div>
      </header>

      {/* 帖子信息流 */}
      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '0' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#87ACCA', padding: '40px', fontSize: '14px' }}>流雲正載著美好趕來...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {videos.map((video) => (
              // 帖子卡片 (Edge-to-Edge)
              <article key={video.post_id || video.id || video.bvid} style={{ backgroundColor: '#FFFFFF', padding: '20px 0', borderBottom: '1px solid #E8EFF5' }}>
                
                {/* 头部：用户信息区 */}
                <div onClick={() => openDetailPage(video)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px', padding: '0 16px', cursor: 'pointer' }}>
                  <div onClick={(event) => openUserPage(event, video)} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: '#D9E4F5',
                      backgroundImage: video.profile_avatar_url ? `url(${video.profile_avatar_url})` : 'none',
                      backgroundPosition: 'center',
                      backgroundSize: 'cover',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#6B99C3',
                      fontWeight: 'bold',
                      border: '1px solid #E8EFF5'
                    }}>
                       {video.profile_avatar_url ? '' : (video.added_by ? video.added_by.charAt(0) : '天')}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#2A3F54', fontWeight: '600', fontSize: '15px' }}>{video.added_by || '策展人'}</span>
                        <span style={{ backgroundColor: '#D9E4F5', color: '#6B99C3', fontSize: '11px', fontWeight: '600', padding: '3px 8px', borderRadius: '99px' }}>INFP</span>
                      </div>
                      <span style={{ color: '#9AA6B2', fontSize: '12px', display: 'block', marginTop: '2px' }}>{formatDate(video.fav_time || video.created_at)}</span>
                    </div>
                  </div>
                  <svg style={{ width: '20px', height: '20px', color: '#9AA6B2' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                </div>

                {/* 文字内容区 */}
                <div onClick={() => openDetailPage(video)} style={{ padding: '0 16px', marginBottom: '14px', cursor: 'pointer' }}>
                  <p style={{ color: '#2A3F54', fontSize: '15px', lineHeight: '1.6', margin: 0, wordBreak: 'break-word', letterSpacing: '0.3px' }}>
                    {video.title}
                  </p>
                </div>

                {/* 美学标签 (原视频标题) */}
                {video.video_title && (
                  <div style={{ padding: '0 16px', marginBottom: '14px' }}>
                    <div onClick={() => openVideoPage(video)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#F4F7FA', color: '#6B99C3', padding: '6px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
                      <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      {video.video_title}
                    </div>
                  </div>
                )}

                {/* 媒体区域 (Edge-to-Edge 满铺，无圆角，无边距) */}
                <div onClick={() => openImmersive(video)} style={{ width: '100%', position: 'relative', paddingTop: '56.25%', backgroundColor: '#F4F7FA', overflow: 'hidden', marginBottom: '16px', cursor: 'pointer' }}>
                  <img src={video.cover} alt={video.title} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  {/* 悬浮播放icon (水彩风) */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '56px', height: '56px', backgroundColor: 'rgba(255, 255, 255, 0.4)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.6)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                    <div style={{ width: 0, height: 0, borderTop: '10px solid transparent', borderBottom: '10px solid transparent', borderLeft: '16px solid #FFFFFF', marginLeft: '6px' }}></div>
                  </div>
                </div>

                {/* 底部互动区 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#9AA6B2', padding: '0 16px' }}>
                  <svg style={{ width: '26px', height: '26px', cursor: 'pointer' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <svg style={{ width: '26px', height: '26px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>{video.comment_count || 0}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => handleToggleLike(event, video)}
                    disabled={likingPostIds.has(video.post_id)}
                    style={{
                      alignItems: 'center',
                      background: 'transparent',
                      border: 'none',
                      color: likedPostIds.has(video.post_id) ? '#D98C8C' : '#9AA6B2',
                      cursor: likingPostIds.has(video.post_id) ? 'wait' : 'pointer',
                      display: 'flex',
                      gap: '6px',
                      padding: 0,
                    }}
                  >
                    <svg style={{ width: '26px', height: '26px' }} fill={likedPostIds.has(video.post_id) ? 'currentColor' : 'none'} stroke={likedPostIds.has(video.post_id) ? '#D98C8C' : 'currentColor'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                    <span style={{ fontSize: '13px', fontWeight: '500' }}>{video.play_count || 0}</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* 懸浮通知入口：底部已經有發布按鈕，這裡先作為通知提醒入口。 */}
      <div onClick={() => goToProtectedPage('/notifications', '請先登入，才能查看通知。')} style={{ position: 'fixed', bottom: '96px', right: '16px', width: '48px', height: '48px', backgroundColor: '#FFFFFF', borderRadius: '50%', boxShadow: '0 4px 14px rgba(42, 82, 122, 0.15)', border: '1px solid #C2D6E6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2A527A', zIndex: 30, cursor: 'pointer' }}>
        <svg style={{ width: '24px', height: '24px' }} fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>
        <span style={{ position: 'absolute', top: 0, right: 0, width: '12px', height: '12px', backgroundColor: '#F4D8CD', border: '2px solid #FFFFFF', borderRadius: '50%' }}></span>
      </div>

      {/* 底部 Tab 栏 (纯白毛玻璃效果) */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '80px', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(194, 214, 230, 0.5)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 8px 16px', zIndex: 20 }}>
        <div onClick={() => router.push('/')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#87ACCA', cursor: 'pointer' }}>
          <svg style={{ width: '24px', height: '24px', marginBottom: '4px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
          <span style={{ fontSize: '10px' }}>大廳</span>
        </div>
        <div onClick={() => router.push('/search')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#2A527A', cursor: 'pointer' }}>
          <svg style={{ width: '24px', height: '24px', marginBottom: '4px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
          <span style={{ fontSize: '10px', fontWeight: '500' }}>探索</span>
        </div>
        {/* 核心加号按钮：矢车菊蓝悬浮 */}
        <div onClick={() => goToProtectedPage('/submit', '請先登入，才能發佈策展。')} style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#6B99C3', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(107, 153, 195, 0.4)', transform: 'translateY(-16px)', border: '4px solid #FFFFFF', color: '#FFFFFF', cursor: 'pointer' }}>
          <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
        </div>
        <div onClick={() => goToProtectedPage('/messages', '請先登入，才能查看訊息。')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#87ACCA', cursor: 'pointer' }}>
          <svg style={{ width: '24px', height: '24px', marginBottom: '4px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
          <span style={{ fontSize: '10px' }}>訊息</span>
        </div>
        <div onClick={() => goToProtectedPage('/u/me', '請先登入，才能進入你的策展人頁。')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#87ACCA', cursor: 'pointer' }}>
          <svg style={{ width: '24px', height: '24px', marginBottom: '4px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
          <span style={{ fontSize: '10px' }}>我的</span>
        </div>
      </nav>

      {/* 浮层 1：私人放映室 (保持暗黑幕布的高级感) */}
      {immersiveVideo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.9)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={closeImmersive} style={{ position: 'absolute', top: '24px', right: '24px', zIndex: 10000, width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', cursor: 'pointer', backdropFilter: 'blur(4px)', fontSize: '20px' }}>✕</div>
          <div style={{ width: '100%', maxWidth: '800px', padding: '0 16px' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
              <iframe src={`//player.bilibili.com/player.html?bvid=${immersiveVideo.bvid}&page=1&autoplay=1&high_quality=1&danmaku=1&loop=1`} scrolling="no" border="0" frameBorder="no" framespacing="0" allowFullScreen={true} allow="autoplay; fullscreen" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}></iframe>
            </div>
            <div style={{ marginTop: '20px', color: '#FFFFFF', textAlign: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '500', margin: '0 0 8px 0', letterSpacing: '0.5px' }}>{immersiveVideo.title}</h2>
              <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>@{immersiveVideo.up_name}</div>
            </div>
          </div>
        </div>
      )}

      {/* 浮层 2：文字单页详情式 (适配雾蓝系风格) */}
      {detailPageVideo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#F0F4F8', zIndex: 999, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, borderBottom: '1px solid rgba(194, 214, 230, 0.5)' }}>
            <div onClick={closeDetailPage} style={{ padding: '8px', cursor: 'pointer', color: '#6B99C3', fontWeight: '500' }}>← 返回</div>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#2A527A', paddingRight: '40px' }}>動態詳情</div>
          </div>
          <div style={{ padding: '20px', paddingBottom: '100px' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', border: '1px solid #C2D6E6' }}>
              <iframe src={`//player.bilibili.com/player.html?bvid=${detailPageVideo.bvid}&page=1&autoplay=1&high_quality=1&loop=1`} scrolling="no" border="0" frameBorder="no" framespacing="0" allowFullScreen={true} allow="autoplay; fullscreen" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}></iframe>
            </div>
            <h2 style={{ fontSize: '18px', marginTop: '20px', color: '#2A527A', lineHeight: '1.6' }}>{detailPageVideo.title}</h2>
            <div style={{ color: '#87ACCA', fontSize: '14px', marginTop: '10px' }}>UP 主：<span style={{ color: '#6B99C3' }}>{detailPageVideo.up_name}</span></div>
            <div style={{ marginTop: '40px', padding: '30px 20px', textAlign: 'center', color: '#87ACCA', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px dashed #C2D6E6' }}>
              留言區正在搭建中...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
