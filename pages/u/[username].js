import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import AestheteBadge from '@/components/AestheteBadge';
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
            message: '請先登入，才能進入您的策展人頁。',
            replace: true,
          });

          if (!user) return;

          const { data: myProfile, error: myProfileError } = await supabase
            .from('profiles')
            .select('username, role')
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
          .select('id, username, display_name, avatar_url, bio, aesthetic_tags, role')
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
      <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh', display: 'flex', flexDirection: 'column', overflowX: 'hidden', width: '100%' }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: '680px', margin: '0 auto' }}>
          <div className="app-detail-skeleton" style={{ height: '140px', width: '100%', borderRadius: 0 }} />
          <div style={{ padding: '0 20px', marginTop: '-36px', position: 'relative', display: 'grid', gap: '16px' }}>
            <div className="app-detail-skeleton" style={{ borderRadius: '50%', height: '84px', width: '84px', border: '3px solid var(--bg-base)' }} />
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
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>
        <p>{errorMessage}</p>
        <button onClick={() => router.push('/')} style={{ marginTop: '16px', padding: '8px 16px', backgroundColor: 'var(--brand-blue)', border: 'none', borderRadius: '6px', color: '#FFFFFF', cursor: 'pointer' }}>回首頁</button>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <>
      <div style={{
      backgroundColor: 'var(--bg-base)',
      minHeight: '100vh',
      color: 'var(--text-primary)',
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
          backgroundColor: 'var(--border-light)',
          width: '100%' 
        }}>
          <button 
            onClick={goBack}
            style={{ position: 'absolute', top: '16px', left: '16px', background: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-primary)' }}
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
              backgroundColor: 'var(--bg-surface)',
              border: '3px solid var(--bg-base)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundImage: profile.avatar_url ? `url("${profile.avatar_url}")` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}>
              {!profile.avatar_url && (
                <span style={{ fontSize: '28px', fontWeight: 600, color: 'var(--text-tertiary)' }}>{getInitial(displayName)}</span>
              )}
            </div>

            {/* Action Button */}
            {isOwnProfile ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => router.push('/submit')}
                  style={{
                    backgroundColor: 'var(--brand-blue)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  採樣
                </button>
                <button
                  onClick={() => router.push('/settings')}
                  style={{
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
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
                    backgroundColor: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  私訊
                </button>
                <button
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                  style={{
                    backgroundColor: isFollowing ? 'var(--brand-blue-light)' : 'var(--brand-blue)',
                    color: isFollowing ? 'var(--text-secondary)' : '#FFFFFF',
                    border: `1px solid ${isFollowing ? 'var(--border-light)' : 'var(--brand-blue)'}`,
                    borderRadius: '6px',
                    padding: '6px 18px',
                    fontSize: '13px',
                    fontWeight: 500,
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
            <div style={{ alignItems: 'center', display: 'flex', gap: '7px', marginBottom: '4px' }}>
              <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, margin: 0 }}>
                {displayName}
              </h1>
              <AestheteBadge role={profile.role} />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              審美號：{profile.username}
            </div>
          </div>

          {/* Bio */}
          <p style={{ margin: '0 0 20px 0', fontSize: '14px', lineHeight: 1.6, color: 'var(--text-primary)' }}>
            {profile.bio || '這個人很懶，什麼都沒寫。'}
          </p>

          {aestheticTags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '-6px 0 20px' }}>
              {aestheticTags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    backgroundColor: 'var(--brand-blue-light)',
                    color: 'var(--brand-blue)',
                    fontSize: '12px',
                    padding: '4px 10px',
                    borderRadius: '4px',
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Stats Row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px', borderBottom: '1px solid var(--border-light)', paddingBottom: '16px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{posts.length}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>策展</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{totalLikes}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>獲讚</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{followerCount}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>粉絲</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{followingCount}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>關注</span>
            </div>
          </div>

          <h2 style={{ fontSize: '15px', fontWeight: 600, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
            策展動態
          </h2>

          {/* Masonry Feed */}
          {posts.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-tertiary)', padding: '40px 0' }}>
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
                        backgroundColor: 'var(--bg-surface)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        border: '1px solid var(--border-light)'
                      }}
                    >
                      {/* Cover */}
                      <div style={{ width: '100%', paddingTop: '133%', position: 'relative', backgroundColor: 'var(--bg-base)' }}>
                        {video.cover_url && (
                          <img 
                            src={video.cover_url} 
                            alt={video.title} 
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} 
                          />
                        )}
                        {!video.cover_url && (
                          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: '12px' }}>無封面</div>
                        )}
                      </div>

                      {/* Content Snippet */}
                      <div style={{ padding: '10px 12px' }}>
                        <div style={{ 
                          fontSize: '13px', 
                          fontWeight: '600', 
                          color: 'var(--text-primary)',
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
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                             <span style={{ width: '14px', height: '14px', borderRadius: '50%', backgroundColor: 'var(--border-light)', display: 'inline-block', backgroundImage: profile.avatar_url ? `url("${profile.avatar_url}")` : 'none', backgroundSize: 'cover' }} />
                             {displayName.slice(0, 8)}{displayName.length > 8 ? '...' : ''}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
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
