import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { requireLogin } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';

const pageStyle = {
  backgroundColor: 'var(--bg-base)',
  color: 'var(--text-primary)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  minHeight: '100vh',
};

const cardStyle = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-light)',
  borderRadius: '8px',
};

function formatDate(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDisplayName(post, profile) {
  return profile?.display_name || profile?.username || post.legacy_added_by || '策展人';
}

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '審';
}

function buildSubmitHref(video) {
  const params = new URLSearchParams();

  if (video?.external_id) {
    params.set('bvid', video.external_id);
  }

  if (video?.title) {
    params.set('title', video.title);
  }

  return `/submit${params.toString() ? `?${params.toString()}` : ''}`;
}

export default function VideoPage() {
  const router = useRouter();
  const { id } = router.query;
  const [video, setVideo] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const goToSubmit = async () => {
    const path = buildSubmitHref(video);

    try {
      const user = await requireLogin({
        router,
        nextPath: path,
        message: '請先登入，才能推薦這支影片。',
      });

      if (user) {
        router.push(path);
      }
    } catch (error) {
      console.error('登入狀態檢查失敗:', error);
      setErrorMessage('登入狀態確認失敗，請稍後再試。');
    }
  };

  useEffect(() => {
    if (!id) return;

    async function loadVideoPage() {
      setLoading(true);
      setErrorMessage('');

      try {
        const { data: videoData, error: videoError } = await supabase
          .from('videos')
          .select('id, external_id, source_url, title, cover_url, author_name, created_at')
          .eq('id', id)
          .single();

        if (videoError) {
          throw videoError;
        }

        setVideo(videoData);

        const { data: postsData, error: postsError } = await supabase
          .from('posts')
          .select('id, user_id, legacy_added_by, note, created_at, like_count, comment_count')
          .eq('video_id', videoData.id)
          .eq('status', 'published')
          .eq('visibility', 'public')
          .order('created_at', { ascending: false });

        if (postsError) {
          throw postsError;
        }

        const posts = postsData || [];
        setRecommendations(posts);

        const profileIds = [...new Set(posts.map((post) => post.user_id).filter(Boolean))];

        if (profileIds.length === 0) {
          setProfilesById({});
          return;
        }

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', profileIds);

        if (profilesError) {
          throw profilesError;
        }

        const nextProfilesById = {};
        (profilesData || []).forEach((profile) => {
          nextProfilesById[profile.id] = profile;
        });

        setProfilesById(nextProfilesById);
      } catch (error) {
        console.error('影片主頁載入失敗:', error);
        setErrorMessage('這支影片暫時無法顯示，可能已被移除或尚未公開。');
      } finally {
        setLoading(false);
      }
    }

    loadVideoPage();
  }, [id]);

  const goBack = () => {
    // 保留使用者從首頁或某篇推薦進入的來源路徑；直連影片頁則安全回首頁。
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
  };

  return (
    <div className="app-detail-page" style={pageStyle}>
      <Head>
        <title>{video ? `${video.title || '影片'} · 審美者` : '影片 · 審美者'}</title>
      </Head>

      <header style={{
        alignItems: 'center',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '48px 18px 14px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button
          type="button"
          onClick={goBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 500,
            padding: 0,
          }}
        >
          ← 返回
        </button>
        <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>影片主頁</div>
        <button
          type="button"
          onClick={goToSubmit}
          style={{
            backgroundColor: 'var(--brand-blue)',
            border: 'none',
            borderRadius: '6px',
            color: '#FFFFFF',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            padding: '6px 14px',
          }}
        >
          推薦
        </button>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '760px', padding: '18px 16px 88px' }}>
        {loading && (
          <div style={{ display: 'grid', gap: '16px', padding: '4px 0 28px' }}>
            <div className="app-detail-skeleton" style={{ height: '190px', borderRadius: '8px' }} />
            <div style={{ display: 'grid', gap: '10px', padding: '0 4px' }}>
              <div className="app-detail-skeleton" style={{ height: '20px', width: '52%', borderRadius: '4px' }} />
              <div className="app-detail-skeleton" style={{ height: '14px', width: '34%', borderRadius: '4px' }} />
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', paddingTop: '4px', textAlign: 'center' }}>
              正在整理這支影片的審美痕跡...
            </div>
          </div>
        )}

        {!loading && errorMessage && (
          <section style={{ ...cardStyle, padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ color: '#FF4D4F', fontSize: '13px', fontWeight: '500', lineHeight: 1.8 }}>{errorMessage}</div>
          </section>
        )}

        {!loading && video && (
          <article style={{ display: 'grid', gap: '16px' }}>
            <section style={{ ...cardStyle, overflow: 'hidden' }}>
              <div style={{
                backgroundColor: '#0E1722',
                position: 'relative',
                width: '100%',
                paddingTop: '56.25%',
              }}>
                {video.external_id ? (
                  <iframe
                    src={`//player.bilibili.com/player.html?bvid=${video.external_id}&page=1&high_quality=1&danmaku=1`}
                    scrolling="no"
                    border="0"
                    frameBorder="no"
                    framespacing="0"
                    allowFullScreen={true}
                    allow="autoplay; fullscreen"
                    style={{
                      border: 'none',
                      height: '100%',
                      left: 0,
                      position: 'absolute',
                      top: 0,
                      width: '100%',
                    }}
                  />
                ) : (
                  <div style={{
                    alignItems: 'center',
                    color: '#C2D6E6',
                    display: 'flex',
                    inset: 0,
                    justifyContent: 'center',
                    position: 'absolute',
                  }}>
                    影片暫時無法播放
                  </div>
                )}
              </div>

              <div style={{ padding: '18px' }}>
                <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, lineHeight: 1.45, margin: 0 }}>
                  {video.title || '未命名影片'}
                </h1>
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, marginTop: '8px' }}>
                  UP 主：{video.author_name || '未知'}
                </div>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', lineHeight: 1.7, margin: '12px 0 0' }}>
                  這裡收錄這支影片在審美者留下的推薦；每一篇推薦，都有自己的對話。
                </p>
              </div>
            </section>

            <section style={{
              ...cardStyle,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 600 }}>{recommendations.length}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>推薦</div>
              </div>
              <div style={{ borderLeft: '1px solid var(--border-light)', padding: '16px', textAlign: 'center' }}>
                <div style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: 600 }}>
                  {recommendations.reduce((sum, post) => sum + (post.like_count || 0), 0)}
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>喜歡</div>
              </div>
            </section>

            <section style={{ display: 'grid', gap: '12px' }}>
              <h2 style={{
                color: 'var(--text-primary)',
                fontSize: '16px',
                fontWeight: 600,
                margin: '6px 2px 0',
              }}>
                所有推薦
              </h2>

              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, margin: '-4px 2px 2px' }}>
                想聊聊這支影片？走進一篇推薦，從那個人的觀看開始。
              </p>

              {recommendations.length === 0 && (
                <div style={{ ...cardStyle, color: 'var(--text-tertiary)', lineHeight: 1.8, padding: '22px 18px', textAlign: 'center', fontSize: '13px' }}>
                  還沒有人推薦這支影片。你可以成為第一個把它放進大廳的人。
                </div>
              )}

              {recommendations.map((post) => {
                const profile = post.user_id ? profilesById[post.user_id] : null;
                const displayName = getDisplayName(post, profile);

                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => router.push(`/p/${post.id}`)}
                    style={{
                      ...cardStyle,
                      cursor: 'pointer',
                      display: 'block',
                      padding: '16px',
                      textAlign: 'left',
                    }}
                  >
                    <div style={{ alignItems: 'center', display: 'flex', gap: '12px', marginBottom: '12px' }}>
                      <div
                        aria-label={displayName}
                        style={{
                          alignItems: 'center',
                          backgroundColor: 'var(--bg-base)',
                          backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none',
                          backgroundPosition: 'center',
                          backgroundSize: 'cover',
                          borderRadius: '50%',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          flex: '0 0 auto',
                          fontWeight: 600,
                          height: '38px',
                          justifyContent: 'center',
                          width: '38px',
                          border: '1px solid var(--border-light)'
                        }}
                      >
                        {profile?.avatar_url ? '' : getInitial(displayName)}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600 }}>{displayName}</div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '3px' }}>
                          {formatDate(post.created_at)}
                        </div>
                      </div>
                    </div>

                    <p style={{
                      color: 'var(--text-secondary)',
                      fontSize: '14px',
                      lineHeight: 1.7,
                      margin: 0,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {post.note}
                    </p>

                    <div style={{
                      color: 'var(--text-tertiary)',
                      display: 'flex',
                      fontSize: '12px',
                      gap: '14px',
                      marginTop: '12px',
                    }}>
                      <span>{post.like_count || 0} 喜歡</span>
                      <span>{post.comment_count || 0} 留言</span>
                    </div>
                  </button>
                );
              })}
            </section>

          </article>
        )}
      </main>
    </div>
  );
}
