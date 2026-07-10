import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { requireLogin } from '@/lib/auth/requireLogin';
import { showToast } from '@/lib/ui/toast';
import { loadUnreadNotificationCount } from '@/lib/notifications/userNotifications';
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
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  // 身份與 Profile 是兩個請求：在兩者都確認前保留載入狀態，
  // 避免右上角依序出現「訪客 -> 預設頭像 -> 真實頭像」的跳動。
  const [isIdentityLoading, setIsIdentityLoading] = useState(true);
  
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

    let isActive = true;

    async function loadIdentity() {
      try {
        // 先確認登入身份；未登入時不需要再請求 profiles。
        const { data: { user } } = await supabase.auth.getUser();
        if (!isActive) return;

        setCurrentUser(user || null);

        if (!user) return;

        loadUnreadNotificationCount()
          .then((count) => {
            if (isActive) setUnreadNotificationCount(count);
          })
          .catch((error) => console.warn('讀取未讀通知失敗:', error));

        // 頭像與 username 都準備好後才結束載入，避免預設圖短暫閃過。
        const { data, error } = await supabase
          .from('profiles')
          .select('avatar_url, username')
          .eq('id', user.id)
          .single();

        if (!isActive) return;

        if (error) {
          console.error('讀取個人資料失敗:', error);
        } else {
          setUserProfile(data || null);
        }
      } catch (error) {
        // 即使身份確認失敗也結束骨架狀態，讓使用者仍可看到登入入口。
        console.error('讀取登入身份失敗:', error);
      } finally {
        if (isActive) setIsIdentityLoading(false);
      }
    }

    loadIdentity();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (loading || typeof window === 'undefined') return;

    const savedScrollY = window.sessionStorage.getItem('shenmei:home-scroll-y');
    if (!savedScrollY) return;

    // 等首頁資料完成渲染後再回到原位置，避免卡片尚未出現時捲動失效。
    window.sessionStorage.removeItem('shenmei:home-scroll-y');
    window.requestAnimationFrame(() => {
      window.scrollTo(0, Number(savedScrollY));
    });
  }, [loading]);

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
      showToast('登入狀態確認失敗，請稍後再試。');
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
      console.error('切換喜歡狀態失敗:', error);
      showToast('喜歡操作失敗，請稍後再試。');
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

          {isIdentityLoading ? (
            <div
              aria-label="正在載入帳號"
              style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#D9E4F5', border: '1px solid #C2D6E6' }}
            />
          ) : currentUser ? (
            <div 
              onClick={() => router.push('/u/me')} 
              style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#6B99C3', border: '1px solid #2A527A', overflow: 'hidden', cursor: 'pointer' }}
            >
              <img src={userProfile?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${userProfile?.username || currentUser.id}`} alt="你的頭像" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
          <div aria-label="正在載入最新策展" style={{ display: 'grid', gap: '8px', padding: '8px 0 18px' }}>
            {[0, 1, 2].map((index) => (
              <article
                key={index}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: '1px solid rgba(217, 228, 245, 0.72)',
                  display: 'grid',
                  gap: '14px',
                  padding: '16px',
                }}
              >
                <div style={{ alignItems: 'center', display: 'flex', gap: '10px' }}>
                  <div className="app-detail-skeleton" style={{ borderRadius: '50%', height: '30px', width: '30px' }} />
                  <div style={{ display: 'grid', gap: '7px' }}>
                    <div className="app-detail-skeleton" style={{ height: '12px', width: '86px' }} />
                    <div className="app-detail-skeleton" style={{ height: '10px', width: '54px' }} />
                  </div>
                </div>

                <div className="app-detail-skeleton" style={{ borderRadius: '12px', height: '220px' }} />

                <div style={{ display: 'grid', gap: '8px' }}>
                  <div className="app-detail-skeleton" style={{ height: '15px', width: '72%' }} />
                  <div className="app-detail-skeleton" style={{ height: '12px', width: '94%' }} />
                  <div className="app-detail-skeleton" style={{ height: '12px', width: '58%' }} />
                </div>

                <div style={{ display: 'flex', gap: '18px' }}>
                  <div className="app-detail-skeleton" style={{ height: '12px', width: '32px' }} />
                  <div className="app-detail-skeleton" style={{ height: '12px', width: '32px' }} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {videos.map((video) => (
              // 帖子卡片 (超紧凑 21:9 单列)
              <article key={video.post_id || video.id || video.bvid} style={{ backgroundColor: '#FFFFFF', padding: '12px 0', borderBottom: '1px solid #E8EFF5' }}>
                
                {/* 头部：用户信息区 (极限同行合并) */}
                <div onClick={() => openDetailPage(video)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 16px', cursor: 'pointer' }}>
                  <div onClick={(event) => openUserPage(event, video)} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
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
                      fontSize: '12px',
                      border: '1px solid #E8EFF5'
                    }}>
                       {video.profile_avatar_url ? '' : (video.added_by ? video.added_by.charAt(0) : '天')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#2A3F54', fontWeight: '600', fontSize: '14px' }}>{video.added_by || '策展人'}</span>
                      <span style={{ backgroundColor: '#D9E4F5', color: '#6B99C3', fontSize: '9px', fontWeight: '700', padding: '2px 6px', borderRadius: '99px' }}>INFP</span>
                      <span style={{ color: '#9AA6B2', fontSize: '11px', fontWeight: '500' }}>· {formatDate(video.fav_time || video.created_at)}</span>
                    </div>
                  </div>
                  <svg style={{ width: '18px', height: '18px', color: '#C2D6E6' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                </div>

                {/* 媒体区域 (21:9 电影画幅) */}
                <div onClick={() => openImmersive(video)} style={{ width: '100%', position: 'relative', paddingTop: '42.8%', backgroundColor: '#F4F7FA', overflow: 'hidden', marginBottom: '8px', cursor: 'pointer' }}>
                  <img src={video.cover} alt={video.title} referrerPolicy="no-referrer" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  {/* 悬浮播放icon (等比缩小) */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '42px', height: '42px', backgroundColor: 'rgba(255, 255, 255, 0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(6px)', border: '1px solid rgba(255,255,255,0.7)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}>
                    <div style={{ width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '12px solid #FFFFFF', marginLeft: '5px' }}></div>
                  </div>
                </div>

                {/* 文字内容区 (折叠为2行) */}
                <div onClick={() => openDetailPage(video)} style={{ padding: '0 16px', marginBottom: '8px', cursor: 'pointer' }}>
                  <p style={{ color: '#2A3F54', fontSize: '14px', lineHeight: '1.5', margin: 0, wordBreak: 'break-word', letterSpacing: '0.3px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {video.title}
                  </p>
                </div>

                {/* 美学标签 (原视频标题) 与互动图标在一行，极致压缩 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px' }}>
                  {video.video_title ? (
                    <div onClick={() => openVideoPage(video)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#F4F7FA', color: '#6B99C3', padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', maxWidth: '60%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      <svg style={{ width: '12px', height: '12px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.video_title}</span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* 右侧底部互动区 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', color: '#9AA6B2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                      <span style={{ fontSize: '12px', fontWeight: '500' }}>{video.comment_count || 0}</span>
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
                        gap: '4px',
                        padding: 0,
                      }}
                    >
                      <svg style={{ width: '20px', height: '20px' }} fill={likedPostIds.has(video.post_id) ? 'currentColor' : 'none'} stroke={likedPostIds.has(video.post_id) ? '#D98C8C' : 'currentColor'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                      <span style={{ fontSize: '12px', fontWeight: '500' }}>{video.play_count || 0}</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* 懸浮通知入口：底部已經有發布按鈕，這裡先作為通知提醒入口。 */}
      <div onClick={() => goToProtectedPage('/notifications', '請先登入，才能查看通知。')} style={{ position: 'fixed', bottom: '96px', right: '16px', width: '48px', height: '48px', backgroundColor: '#FFFFFF', borderRadius: '50%', boxShadow: '0 4px 14px rgba(42, 82, 122, 0.15)', border: '1px solid #C2D6E6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2A527A', zIndex: 30, cursor: 'pointer' }}>
        <svg style={{ width: '24px', height: '24px' }} fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>
        {unreadNotificationCount > 0 && (
          <span style={{ position: 'absolute', top: 0, right: 0, minWidth: '12px', height: '12px', backgroundColor: '#F4B9AE', border: '2px solid #FFFFFF', borderRadius: '999px', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: unreadNotificationCount > 9 ? '7px' : '8px', fontWeight: 700, padding: unreadNotificationCount > 9 ? '0 2px' : 0 }}>
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </div>

      {/* 底部主導航：首頁預設為啟用狀態，發布保留為視覺焦點。 */}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '80px', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)', borderTop: '1px solid rgba(194, 214, 230, 0.5)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 8px 16px', zIndex: 20 }}>
        <div onClick={() => router.push('/')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#2A527A', cursor: 'pointer' }}>
          <svg style={{ width: '24px', height: '24px', marginBottom: '4px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z"></path></svg>
          <span style={{ fontSize: '10px', fontWeight: '700' }}>首頁</span>
        </div>
        <div onClick={() => router.push('/m')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#87ACCA', cursor: 'pointer' }}>
          <svg style={{ width: '24px', height: '24px', marginBottom: '4px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M4 5.5A1.5 1.5 0 015.5 4H10v7H4V5.5zM14 4h4.5A1.5 1.5 0 0120 5.5V11h-6V4zM4 15h6v5H5.5A1.5 1.5 0 014 18.5V15zM14 15h6v3.5a1.5 1.5 0 01-1.5 1.5H14v-5z"></path></svg>
          <span style={{ fontSize: '10px', fontWeight: '500' }}>小館</span>
        </div>
        <div onClick={() => goToProtectedPage('/submit', '請先登入，才能發佈策展。')} style={{ alignItems: 'center', color: '#6B99C3', cursor: 'pointer', display: 'flex', flexDirection: 'column', marginTop: '-22px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#6B99C3', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(107, 153, 195, 0.4)', border: '4px solid #FFFFFF', color: '#FFFFFF' }}>
            <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
          </div>
          <span style={{ fontSize: '10px', fontWeight: '700', marginTop: '4px' }}>發布</span>
        </div>
        <div onClick={() => goToProtectedPage('/messages', '請先登入，才能查看訊息。')} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', color: '#87ACCA', cursor: 'pointer' }}>
          <svg style={{ width: '24px', height: '24px', marginBottom: '4px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
          <span style={{ fontSize: '10px' }}>私訊</span>
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
          <div style={{ width: '100%', maxWidth: '800px' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
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
          <div style={{ paddingBottom: '100px' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000', border: '1px solid #C2D6E6' }}>
              <iframe src={`//player.bilibili.com/player.html?bvid=${detailPageVideo.bvid}&page=1&autoplay=1&high_quality=1&loop=1`} scrolling="no" border="0" frameBorder="no" framespacing="0" allowFullScreen={true} allow="autoplay; fullscreen" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}></iframe>
            </div>
            <div style={{ padding: '0 20px' }}>
              <h2 style={{ fontSize: '18px', marginTop: '20px', color: '#2A527A', lineHeight: '1.6' }}>{detailPageVideo.title}</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '14px', color: '#6B99C3', fontWeight: '500' }}>@{detailPageVideo.up_name}</span>
                <span style={{ fontSize: '13px', color: '#87ACCA' }}>{detailPageVideo.play_count} 次觀看</span>
              </div>
              <div style={{ marginTop: '40px', padding: '30px 20px', textAlign: 'center', color: '#87ACCA', backgroundColor: '#FFFFFF', borderRadius: '16px', border: '1px dashed #C2D6E6' }}>
                這裡之後可以放評論區或更多推薦
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
