import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { requireLogin } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';

const pageStyle = {
  backgroundColor: '#F0F4F8',
  color: '#2A527A',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  minHeight: '100vh',
};

const cardStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid rgba(194, 214, 230, 0.55)',
  borderRadius: '18px',
  boxShadow: '0 1px 4px rgba(42, 82, 122, 0.06)',
};

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

          if (!user) {
            return;
          }

          const { data: myProfile, error: myProfileError } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', user.id)
            .maybeSingle();

          if (myProfileError) {
            throw myProfileError;
          }

          if (myProfile?.username) {
            router.replace(`/u/${myProfile.username}`);
            return;
          }
        }

        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, created_at')
          .eq('username', targetUsername)
          .maybeSingle();

        if (profileError) {
          throw profileError;
        }

        if (!profileData) {
          setErrorMessage('找不到這位策展人。');
          return;
        }

        setProfile(profileData);

        const currentUser = await requireLogin({ silent: true });
        setIsOwnProfile(Boolean(currentUser && currentUser.id === profileData.id));

        const { data: postsData, error: postsError } = await supabase
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

        if (postsError) {
          throw postsError;
        }

        setPosts(postsData || []);
      } catch (error) {
        console.error('使用者頁載入失敗:', error);
        setErrorMessage('這位策展人的資料暫時無法顯示。');
      } finally {
        setLoading(false);
      }
    }

    loadUserPage();
  }, [router, username]);

  const displayName = profile?.username || '策展人';

  const goToSubmit = async () => {
    try {
      const user = await requireLogin({
        router,
        nextPath: '/submit',
        message: '請先登入，才能發佈策展。',
      });

      if (user) {
        router.push('/submit');
      }
    } catch (error) {
      console.error('登入狀態檢查失敗:', error);
      setErrorMessage('登入狀態確認失敗，請稍後再試。');
    }
  };

  return (
    <div style={pageStyle}>
      <Head>
        <title>{profile ? `${displayName} · 審美者` : '策展人 · 審美者'}</title>
      </Head>

      <header style={{
        alignItems: 'center',
        backgroundColor: 'rgba(240, 244, 248, 0.92)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(194, 214, 230, 0.5)',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '18px 18px 14px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button
          type="button"
          onClick={() => router.push('/')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6B99C3',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 600,
            padding: 0,
          }}
        >
          ← 大廳
        </button>
        <div style={{ color: '#2A527A', fontSize: '15px', fontWeight: 700 }}>策展人</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => router.push('/settings')}
              style={{
                backgroundColor: '#F0F4F8',
                border: '1px solid #C2D6E6',
                borderRadius: '999px',
                color: '#6B99C3',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 700,
                padding: '7px 10px',
              }}
            >
              設定
            </button>
          )}

          <button
            type="button"
            onClick={goToSubmit}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #C2D6E6',
              borderRadius: '999px',
              color: '#6B99C3',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              padding: '7px 10px',
            }}
          >
            發佈
          </button>
        </div>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '760px', padding: '18px 16px 88px' }}>
        {loading && (
          <div style={{ color: '#87ACCA', padding: '44px 0', textAlign: 'center' }}>
            正在翻開這位策展人的檔案...
          </div>
        )}

        {!loading && errorMessage && (
          <section style={{ ...cardStyle, padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ color: '#87ACCA', lineHeight: 1.8 }}>{errorMessage}</div>
          </section>
        )}

        {!loading && profile && (
          <article style={{ display: 'grid', gap: '16px' }}>
            <section style={{ ...cardStyle, padding: '20px' }}>
              <div style={{ alignItems: 'center', display: 'flex', gap: '16px' }}>
                <div
                  aria-label={displayName}
                  style={{
                    alignItems: 'center',
                    backgroundColor: '#C2D6E6',
                    backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : 'none',
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    borderRadius: '28px',
                    color: '#FFFFFF',
                    display: 'flex',
                    flex: '0 0 auto',
                    fontSize: '28px',
                    fontWeight: 900,
                    height: '76px',
                    justifyContent: 'center',
                    width: '76px',
                  }}
                >
                  {profile.avatar_url ? '' : getInitial(displayName)}
                </div>

                <div style={{ minWidth: 0 }}>
                  <h1 style={{ color: '#2A527A', fontSize: '24px', lineHeight: 1.25, margin: 0 }}>
                    {displayName}
                  </h1>
                  <div style={{ color: '#87ACCA', fontSize: '13px', marginTop: '6px' }}>
                    @{profile.username}
                  </div>
                </div>
              </div>

              <p style={{ color: '#6B99C3', fontSize: '14px', lineHeight: 1.8, margin: '18px 0 0' }}>
                {profile.bio || '這位策展人還沒有寫簡介。'}
              </p>

              {profile.aesthetic_tags?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
                  {profile.aesthetic_tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        backgroundColor: '#F0F4F8',
                        border: '1px solid #C2D6E6',
                        borderRadius: '999px',
                        color: '#6B99C3',
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '7px 10px',
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section style={{
              ...cardStyle,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '16px', textAlign: 'center' }}>
                <div style={{ color: '#2A527A', fontSize: '22px', fontWeight: 800 }}>{posts.length}</div>
                <div style={{ color: '#87ACCA', fontSize: '12px', marginTop: '4px' }}>策展</div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(194, 214, 230, 0.55)', padding: '16px', textAlign: 'center' }}>
                <div style={{ color: '#2A527A', fontSize: '22px', fontWeight: 800 }}>
                  {posts.reduce((sum, post) => sum + (post.like_count || 0), 0)}
                </div>
                <div style={{ color: '#87ACCA', fontSize: '12px', marginTop: '4px' }}>收穫喜歡</div>
              </div>
            </section>

            <section style={{ display: 'grid', gap: '12px' }}>
              <h2 style={{ color: '#2A527A', fontSize: '17px', margin: '6px 2px 0' }}>
                策展動態
              </h2>

              {posts.length === 0 && (
                <div style={{ ...cardStyle, color: '#87ACCA', lineHeight: 1.8, padding: '22px 18px', textAlign: 'center' }}>
                  這裡還沒有留下策展痕跡。
                </div>
              )}

              {posts.map((post) => {
                const video = post.videos || {};

                return (
                  <article key={post.id} style={{ ...cardStyle, overflow: 'hidden' }}>
                    {video.cover_url && (
                      <button
                        type="button"
                        onClick={() => router.push(`/v/${video.id}`)}
                        style={{
                          backgroundImage: `url(${video.cover_url})`,
                          backgroundPosition: 'center',
                          backgroundSize: 'cover',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'block',
                          paddingTop: '38%',
                          width: '100%',
                        }}
                        aria-label={video.title || '影片'}
                      />
                    )}

                    <button
                      type="button"
                      onClick={() => router.push(`/p/${post.id}`)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'block',
                        padding: '16px',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <div style={{ color: '#87ACCA', fontSize: '12px', marginBottom: '8px' }}>
                        {formatDate(post.created_at)}
                      </div>

                      <div style={{ color: '#6B99C3', fontSize: '13px', lineHeight: 1.65, marginBottom: '8px' }}>
                        {video.title || '未命名影片'}
                      </div>

                      <p style={{ color: '#2A527A', fontSize: '15px', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>
                        {post.note}
                      </p>

                      <div style={{
                        color: '#87ACCA',
                        display: 'flex',
                        fontSize: '12px',
                        gap: '14px',
                        marginTop: '12px',
                      }}>
                        <span>{post.like_count || 0} 喜歡</span>
                        <span>{post.comment_count || 0} 留言</span>
                      </div>
                    </button>
                  </article>
                );
              })}
            </section>
          </article>
        )}
      </main>
    </div>
  );
}
