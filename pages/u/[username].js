import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import { requireLogin } from '@/lib/auth/requireLogin';
import { cacheProfileRoute } from '@/lib/auth/profileRoute';
import { supabase } from '@/lib/supabase/client';
import { showToast } from '@/lib/ui/toast';
import { cacheProfilePage, getCachedProfilePage } from '@/lib/cache/profilePageCache';
import { loadProfileFollowState, toggleProfileFollow } from '@/lib/follows/profileFollows';

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '審';
}

export default function UserPage() {
  const router = useRouter();
  const { username } = router.query;
  const [profile, setProfile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (!username) return;

    async function loadUserPage() {
      setLoading(true);
      setErrorMessage('');

      try {
        let targetUsername = username;
        setIsOwnProfile(false);

        if (username === 'me') {
          const user = await requireLogin({
            router,
            nextPath: '/u/me',
            message: '請先登入，才能進入你的策展人頁。',
            replace: true,
          });

          if (!user) return;

          const { data: myProfile, error: myProfileError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();

          if (myProfileError) throw myProfileError;

          if (myProfile?.username) {
            router.replace(`/u/${myProfile.username}`);
            return;
          }
        }

        const currentUser = await requireLogin({ silent: true });
        const cachedPage = getCachedProfilePage(targetUsername);
        if (cachedPage) {
          setProfile(cachedPage.profile);
          setPosts(cachedPage.posts);
          setIsOwnProfile(Boolean(currentUser && currentUser.id === cachedPage.profile.id));
          setLoading(false);
        }

        // Fetch target profile
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio, aesthetic_tags')
          .eq('username', targetUsername)
          .maybeSingle();

        if (profileError) throw profileError;

        if (!profileData) {
          setErrorMessage('找不到這位策展人。');
          return;
        }

        setProfile(profileData);

        setIsOwnProfile(Boolean(currentUser && currentUser.id === profileData.id));
        if (currentUser?.id === profileData.id) {
          cacheProfileRoute(currentUser.id, profileData.username);
        }

        const postsRequest = supabase
          .from('posts')
          .select(`
              id,
              note,
              created_at,
              like_count,
              comment_count,
              videos (
                id,
                external_id,
                title,
                cover_url,
                author_name
              )
            `)
          .eq('user_id', profileData.id)
          .eq('status', 'published')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false });

        const [postsResult, followState] = await Promise.all([
          postsRequest,
          loadProfileFollowState(profileData.id).catch((followError) => {
            console.warn('追蹤狀態載入失敗:', followError);
            return { followerCount: 0, followingCount: 0, isFollowing: false };
          }),
        ]);

        if (postsResult.error) throw postsResult.error;

        setPosts(postsResult.data || []);
        cacheProfilePage(profileData, postsResult.data || []);
        setFollowerCount(followState.followerCount);
        setFollowingCount(followState.followingCount);
        setIsFollowing(followState.isFollowing);
      } catch (error) {
        console.error('使用者頁載入失敗:', error);
        setErrorMessage('這位策展人的資料暫時無法顯示。');
      } finally {
        setLoading(false);
      }
    }

    loadUserPage();
  }, [router, username]);

  const displayName = profile?.display_name || profile?.username || '策展人';
  const totalLikes = posts.reduce((sum, post) => sum + (post.like_count || 0), 0);
  const aestheticTags = profile?.aesthetic_tags || [];

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
  };

  const handleToggleFollow = async () => {
    if (!profile || followLoading) return;

    const user = await requireLogin({
      router,
      nextPath: router.asPath,
      message: '請先登入以關注這位策展人。',
    });

    if (!user) return;

    setFollowLoading(true);

    try {
      const result = await toggleProfileFollow(profile.id);
      if (result.requiresLogin || result.isOwnProfile) return;

      setIsFollowing(result.isFollowing);
      setFollowerCount((count) => Math.max(0, count + (result.isFollowing ? 1 : -1)));
      showToast(result.isFollowing ? '已關注這位策展人。' : '已取消關注。');
    } catch (error) {
      console.error('追蹤操作失敗:', error);
      showToast('關注狀態暫時無法更新，請稍後再試。');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleStartMessage = async () => {
    if (!profile?.username) return;

    const user = await requireLogin({
      router,
      nextPath: router.asPath,
      message: '請先登入，才能傳送私訊。',
    });

    if (user) {
      router.push(`/messages/new?user=${profile.username}`);
    }
  };

  if (loading) {
    return (
      <div style={{ backgroundColor: '#F9FAFB', minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', width: '100%' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '680px', margin: '0 auto' }}>
          <div className="app-detail-skeleton" style={{ height: '140px', width: '100%', borderRadius: 0 }} />
          <div style={{ padding: '0 20px', marginTop: '-36px', position: 'relative', display: 'grid', gap: '16px' }}>
            <div className="app-detail-skeleton" style={{ borderRadius: '50%', height: '84px', width: '84px', border: '3px solid #F9FAFB' }} />
            <div className="app-detail-skeleton" style={{ height: '24px', width: '38%' }} />
            <div className="app-detail-skeleton" style={{ height: '14px', width: '68%' }} />
            <div className="app-detail-skeleton" style={{ height: '14px', width: '92%' }} />
            <div className="app-detail-skeleton" style={{ height: '260px' }} />
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#87ACCA' }}>
        <p>{errorMessage}</p>
        <button onClick={() => router.push('/')} style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: '#C2D6E6', border: 'none', borderRadius: '20px', color: '#2A527A', cursor: 'pointer' }}>回首頁</button>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <>
      <div style={{
      backgroundColor: '#F9FAFB',
      minHeight: '100vh',
      color: '#2A527A',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden',
      paddingBottom: '96px',
      width: '100%',
    }}>
      <Head>
        <title>{displayName} · 審美者</title>
      </Head>

      {/* Top Header / Background Wall */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '680px', margin: '0 auto' }}>
        <div style={{ 
          height: '140px', 
          background: 'linear-gradient(135deg, #FFEDD8, #D8E2F8)',
          width: '100%' 
        }}>
          <button 
            onClick={goBack}
            style={{ position: 'absolute', top: '16px', left: '16px', background: 'rgba(255,255,255,0.3)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#2A527A', backdropFilter: 'blur(4px)' }}
          >
            ←
          </button>
        </div>

        {/* Profile Card Container (pulls up into the header) */}
        <div style={{ padding: '0 20px', marginTop: '-36px', position: 'relative' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px' }}>
            {/* Avatar */}
            <div style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: '#FFFFFF',
              border: '3px solid #F9FAFB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(42,82,122,0.08)',
              overflow: 'hidden',
              backgroundImage: profile.avatar_url ? `url("${profile.avatar_url}")` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}>
              {!profile.avatar_url && (
                <span style={{ fontSize: '32px', fontWeight: 800, color: '#C2D6E6' }}>{getInitial(displayName)}</span>
              )}
            </div>

            {/* Action Button */}
            {isOwnProfile ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => router.push('/submit')}
                  style={{
                    backgroundColor: '#6B99C3',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '99px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  發佈策展
                </button>
                <button
                  onClick={() => router.push('/settings')}
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: '#2A527A',
                    border: '1px solid rgba(194, 214, 230, 0.8)',
                    borderRadius: '99px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 6px rgba(42,82,122,0.04)'
                  }}
                >
                  編輯資料
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={handleStartMessage}
                  style={{
                    backgroundColor: '#FFFFFF',
                    color: '#52769A',
                    border: '1px solid #C2D6E6',
                    borderRadius: '99px',
                    padding: '6px 14px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  私訊
                </button>
                <button
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                  style={{
                    backgroundColor: isFollowing ? '#EEF3F7' : '#6B99C3',
                    color: isFollowing ? '#52769A' : '#FFFFFF',
                    border: `1px solid ${isFollowing ? '#D9E4F5' : '#6B99C3'}`,
                    borderRadius: '99px',
                    padding: '6px 18px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: followLoading ? 'wait' : 'pointer',
                    opacity: followLoading ? 0.7 : 1,
                  }}
                >
                  {followLoading ? '處理中' : isFollowing ? '已關注' : '關注'}
                </button>
              </div>
            )}
          </div>

          {/* Info */}
          <div style={{ marginBottom: '16px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 4px 0', color: '#1A365D' }}>
              {displayName}
            </h1>
            <div style={{ fontSize: '13px', color: '#87ACCA' }}>
              審美號：{profile.username}
            </div>
          </div>

          {/* Bio */}
          <p style={{ margin: '0 0 20px 0', fontSize: '14px', lineHeight: 1.6, color: '#4A6984' }}>
            {profile.bio || '這個人很懶，什麼都沒寫。'}
          </p>

          {aestheticTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '-6px 0 20px' }}>
              {aestheticTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    backgroundColor: '#EEF3F7',
                    border: '1px solid #D9E4F5',
                    borderRadius: '999px',
                    color: '#52769A',
                    fontSize: '12px',
                    padding: '5px 10px',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', borderBottom: '1px solid rgba(194, 214, 230, 0.4)', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#1A365D' }}>{posts.length}</span>
              <span style={{ fontSize: '12px', color: '#87ACCA', marginTop: '2px' }}>策展</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#1A365D' }}>{totalLikes}</span>
              <span style={{ fontSize: '12px', color: '#87ACCA', marginTop: '2px' }}>獲讚</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#1A365D' }}>{followerCount}</span>
              <span style={{ fontSize: '12px', color: '#87ACCA', marginTop: '2px' }}>粉絲</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 800, color: '#1A365D' }}>{followingCount}</span>
              <span style={{ fontSize: '12px', color: '#87ACCA', marginTop: '2px' }}>關注</span>
            </div>
          </div>

          <h2 style={{ fontSize: '16px', fontWeight: 700, margin: '0 0 16px 0', color: '#2A527A' }}>
            策展動態
          </h2>

          {/* Masonry Feed */}
          {posts.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#87ACCA', padding: '40px 0' }}>
              這裡還沒有留下策展痕跡。
            </div>
          ) : (
            <div style={{ columnCount: 2, columnGap: '12px' }}>
              {posts.map((post) => {
                const video = post.videos || {};
                return (
                  <div key={post.id} style={{ breakInside: 'avoid', marginBottom: '12px' }}>
                    <div 
                      onClick={() => router.push(`/p/${post.id}`)}
                      style={{
                        backgroundColor: '#FFFFFF',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(42,82,122,0.05)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                      {/* Cover */}
                      <div style={{ width: '100%', paddingTop: '133%', position: 'relative', backgroundColor: '#E1E9F0' }}>
                        {video.cover_url && (
                          <img 
                            src={video.cover_url} 
                            alt={video.title} 
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        )}
                        {!video.cover_url && (
                          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#87ACCA', fontSize: '12px' }}>無封面</div>
                        )}
                      </div>

                      {/* Content Snippet */}
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ 
                          fontSize: '13px', 
                          fontWeight: 600, 
                          color: '#2A527A',
                          display: '-webkit-box', 
                          WebkitLineClamp: 2, 
                          WebkitBoxOrient: 'vertical', 
                          overflow: 'hidden',
                          lineHeight: 1.4,
                          marginBottom: '8px'
                        }}>
                          {post.note || video.title}
                        </div>
                        
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', color: '#87ACCA', display: 'flex', alignItems: 'center', gap: '4px' }}>
                             <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: '#C2D6E6', display: 'inline-block', backgroundImage: profile.avatar_url ? `url("${profile.avatar_url}")` : 'none', backgroundSize: 'cover' }} />
                             {displayName.slice(0, 8)}{displayName.length > 8 ? '...' : ''}
                          </span>
                          <span style={{ fontSize: '11px', color: '#87ACCA', display: 'flex', alignItems: 'center', gap: '2px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            {post.like_count || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      </div>
      <AppBottomNav active="profile" />
    </>
  );
}
