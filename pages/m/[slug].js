import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
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

function getDisplayName(post, profile) {
  return profile?.display_name || profile?.username || post.legacy_added_by || '策展人';
}

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '審';
}

export default function ModuleDetailPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [module, setModule] = useState(null);
  const [posts, setPosts] = useState([]);
  const [profilesById, setProfilesById] = useState({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!slug) return;

    async function loadModulePage() {
      setLoading(true);
      setErrorMessage('');

      try {
        const { data: moduleData, error: moduleError } = await supabase
          .from('modules')
          .select('id, slug, name, description, cover_url, theme_color, created_at')
          .eq('slug', slug)
          .eq('status', 'active')
          .single();

        if (moduleError) {
          throw moduleError;
        }

        setModule(moduleData);

        const { data: rows, error: rowsError } = await supabase
          .from('post_modules')
          .select(`
            posts (
              id,
              user_id,
              legacy_added_by,
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
            )
          `)
          .eq('module_id', moduleData.id);

        if (rowsError) {
          throw rowsError;
        }

        const nextPosts = (rows || [])
          .map((row) => row.posts)
          .filter(Boolean)
          .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));

        setPosts(nextPosts);

        const profileIds = [...new Set(nextPosts.map((post) => post.user_id).filter(Boolean))];

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
        console.error('小館詳情載入失敗:', error);
        setErrorMessage('這座小館暫時無法顯示，可能尚未開放或已被移除。');
      } finally {
        setLoading(false);
      }
    }

    loadModulePage();
  }, [slug]);

  return (
    <div style={pageStyle}>
      <Head>
        <title>{module ? `${module.name} · 審美者` : '小館 · 審美者'}</title>
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
          onClick={() => router.push('/m')}
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
          ← 小館
        </button>
        <div style={{ color: '#2A527A', fontSize: '15px', fontWeight: 700 }}>小館詳情</div>
        <button
          type="button"
          onClick={() => router.push('/submit')}
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
          投稿
        </button>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '760px', padding: '18px 16px 88px' }}>
        {loading && (
          <div style={{ color: '#87ACCA', padding: '44px 0', textAlign: 'center' }}>
            正在打開小館...
          </div>
        )}

        {!loading && errorMessage && (
          <section style={{ ...cardStyle, padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ color: '#87ACCA', lineHeight: 1.8 }}>{errorMessage}</div>
          </section>
        )}

        {!loading && module && (
          <article style={{ display: 'grid', gap: '16px' }}>
            <section style={{
              ...cardStyle,
              overflow: 'hidden',
            }}>
              <div style={{
                backgroundColor: module.theme_color || '#C2D6E6',
                backgroundImage: module.cover_url ? `linear-gradient(rgba(42, 82, 122, 0.1), rgba(42, 82, 122, 0.45)), url(${module.cover_url})` : 'none',
                backgroundPosition: 'center',
                backgroundSize: 'cover',
                minHeight: '136px',
                padding: '24px 18px',
              }}>
                <div style={{ color: '#FFFFFF', fontSize: '28px', fontWeight: 900, lineHeight: 1.2 }}>
                  {module.name}
                </div>
                <div style={{ color: 'rgba(255, 255, 255, 0.86)', fontSize: '13px', marginTop: '8px' }}>
                  /m/{module.slug}
                </div>
              </div>

              <div style={{ padding: '18px' }}>
                <p style={{ color: '#6B99C3', fontSize: '14px', lineHeight: 1.8, margin: 0 }}>
                  {module.description || '這座小館還沒有介紹，但已經可以開始收納策展。'}
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
                <div style={{ color: '#2A527A', fontSize: '22px', fontWeight: 800 }}>{posts.length}</div>
                <div style={{ color: '#87ACCA', fontSize: '12px', marginTop: '4px' }}>策展</div>
              </div>
              <div style={{ borderLeft: '1px solid rgba(194, 214, 230, 0.55)', padding: '16px', textAlign: 'center' }}>
                <div style={{ color: '#2A527A', fontSize: '22px', fontWeight: 800 }}>
                  {posts.reduce((sum, post) => sum + (post.like_count || 0), 0)}
                </div>
                <div style={{ color: '#87ACCA', fontSize: '12px', marginTop: '4px' }}>喜歡</div>
              </div>
            </section>

            <section style={{ display: 'grid', gap: '12px' }}>
              <h2 style={{ color: '#2A527A', fontSize: '17px', margin: '6px 2px 0' }}>
                最新策展
              </h2>

              {posts.length === 0 && (
                <div style={{ ...cardStyle, color: '#87ACCA', lineHeight: 1.8, padding: '22px 18px', textAlign: 'center' }}>
                  這座小館還沒有策展。等第一束光被放進來。
                </div>
              )}

              {posts.map((post) => {
                const profile = post.user_id ? profilesById[post.user_id] : null;
                const displayName = getDisplayName(post, profile);
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
                      <div style={{ alignItems: 'center', display: 'flex', gap: '12px', marginBottom: '12px' }}>
                        <div
                          aria-label={displayName}
                          style={{
                            alignItems: 'center',
                            backgroundColor: '#C2D6E6',
                            backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none',
                            backgroundPosition: 'center',
                            backgroundSize: 'cover',
                            borderRadius: '50%',
                            color: '#FFFFFF',
                            display: 'flex',
                            flex: '0 0 auto',
                            fontWeight: 800,
                            height: '38px',
                            justifyContent: 'center',
                            width: '38px',
                          }}
                        >
                          {profile?.avatar_url ? '' : getInitial(displayName)}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: '#2A527A', fontSize: '14px', fontWeight: 700 }}>{displayName}</div>
                          <div style={{ color: '#87ACCA', fontSize: '12px', marginTop: '3px' }}>
                            {formatDate(post.created_at)}
                          </div>
                        </div>
                      </div>

                      <div style={{ color: '#6B99C3', fontSize: '13px', lineHeight: 1.65, marginBottom: '8px' }}>
                        {video.title || '未命名影片'}
                      </div>

                      <p style={{ color: '#2A527A', fontSize: '15px', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-wrap' }}>
                        {post.note}
                      </p>
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
