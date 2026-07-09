import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { requireLogin } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';
import { loadLikedPostIds, togglePostLike } from '@/lib/reactions/postLikes';

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
  return profile?.username || post?.legacy_added_by || '策展人';
}

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '審';
}

export default function PostPage() {
  const router = useRouter();
  const { id } = router.query;
  const [post, setPost] = useState(null);
  const [profile, setProfile] = useState(null);
  const [modules, setModules] = useState([]);
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentMessage, setCommentMessage] = useState('');

  useEffect(() => {
    if (!id) return;

    async function loadPost() {
      setLoading(true);
      setErrorMessage('');

      try {
        const { data: postData, error: postError } = await supabase
          .from('posts')
          .select(`
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
              source_url,
              title,
              cover_url,
              author_name
            )
          `)
          .eq('id', id)
          .eq('status', 'published')
          .eq('visibility', 'public')
          .single();

        if (postError) {
          throw postError;
        }

        setPost(postData);
        setLiked(false);

        if (postData.user_id) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('id', postData.user_id)
            .maybeSingle();

          if (profileError) {
            throw profileError;
          }

          setProfile(profileData);
        } else {
          setProfile(null);
        }

        const { data: moduleRows, error: moduleError } = await supabase
          .from('post_modules')
          .select('modules (id, slug, name)')
          .eq('post_id', postData.id);

        if (moduleError) {
          throw moduleError;
        }

        setModules((moduleRows || []).map((row) => row.modules).filter(Boolean));

        const likedPostIds = await loadLikedPostIds([postData.id]);
        setLiked(likedPostIds.has(postData.id));

        const user = await requireLogin({ silent: true });
        setCurrentUser(user);
      } catch (error) {
        console.error('策展動態載入失敗:', error);
        setErrorMessage('這條策展動態暫時無法顯示，可能已被移除或尚未公開。');
      } finally {
        setLoading(false);
      }
    }

    loadPost();
  }, [id]);

  const video = post?.videos || {};
  const displayName = getDisplayName(post, profile);

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
      alert('登入狀態確認失敗，請稍後再試。');
    }
  };

  const goToLoginForComment = async () => {
    try {
      await requireLogin({
        router,
        nextPath: router.asPath,
        message: '請先登入，才能留言。',
      });
    } catch (error) {
      console.error('登入狀態檢查失敗:', error);
      setCommentMessage('登入狀態確認失敗，請稍後再試。');
    }
  };

  const handleSubmitCommentPreview = async (event) => {
    event.preventDefault();
    setCommentMessage('');

    if (!currentUser) {
      await goToLoginForComment();
      return;
    }

    if (commentDraft.trim().length < 2) {
      setCommentMessage('留言至少需要 2 個字。');
      return;
    }

    setCommentMessage('留言介面已準備好，下一步會接上資料庫保存。');
  };

  const handleToggleLike = async () => {
    if (!post?.id || liking) {
      return;
    }

    setLiking(true);

    try {
      const result = await togglePostLike(post.id);

      if (result.requiresLogin) {
        await requireLogin({
          router,
          nextPath: router.asPath,
          message: '請先登入，才能喜歡這條策展。',
        });
        return;
      }

      setLiked(result.liked);
      setPost((currentPost) => ({
        ...currentPost,
        like_count: Math.max(0, (currentPost.like_count || 0) + result.delta),
      }));
    } catch (error) {
      console.error('喜歡操作失敗:', error);
      alert('喜歡操作失敗，請稍後再試。');
    } finally {
      setLiking(false);
    }
  };

  return (
    <div style={pageStyle}>
      <Head>
        <title>{post ? `${video.title || '策展動態'} · 審美者` : '策展動態 · 審美者'}</title>
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
        <div style={{ color: '#2A527A', fontSize: '15px', fontWeight: 700 }}>策展動態</div>
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
      </header>

      <main style={{ margin: '0 auto', maxWidth: '720px', padding: '18px 16px 88px' }}>
        {loading && (
          <div style={{ color: '#87ACCA', padding: '44px 0', textAlign: 'center' }}>
            正在取出這條策展...
          </div>
        )}

        {!loading && errorMessage && (
          <section style={{ ...cardStyle, padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ color: '#87ACCA', lineHeight: 1.8 }}>{errorMessage}</div>
          </section>
        )}

        {!loading && post && (
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
                <h1 style={{ color: '#2A527A', fontSize: '20px', lineHeight: 1.45, margin: 0 }}>
                  {video.title || '未命名影片'}
                </h1>

                <div style={{ color: '#87ACCA', fontSize: '13px', marginTop: '8px' }}>
                  UP 主：{video.author_name || '未知'}
                </div>
              </div>
            </section>

            <section style={{ ...cardStyle, padding: '18px' }}>
              <div style={{ alignItems: 'center', display: 'flex', gap: '12px', marginBottom: '16px' }}>
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
                    fontWeight: 800,
                    height: '44px',
                    justifyContent: 'center',
                    width: '44px',
                  }}
                >
                  {profile?.avatar_url ? '' : getInitial(displayName)}
                </div>

                <div>
                  <div style={{ color: '#2A527A', fontSize: '15px', fontWeight: 700 }}>{displayName}</div>
                  <div style={{ color: '#87ACCA', fontSize: '12px', marginTop: '3px' }}>
                    {formatDate(post.created_at)}
                  </div>
                </div>
              </div>

              <p style={{ color: '#2A527A', fontSize: '16px', lineHeight: 1.85, margin: 0, whiteSpace: 'pre-wrap' }}>
                {post.note}
              </p>

              {modules.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '18px' }}>
                  {modules.map((module) => (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => router.push(`/m/${module.slug}`)}
                      style={{
                        backgroundColor: '#F0F4F8',
                        border: '1px solid #C2D6E6',
                        borderRadius: '999px',
                        color: '#6B99C3',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 700,
                        padding: '7px 10px',
                      }}
                    >
                      {module.name}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section style={{
              ...cardStyle,
              display: 'grid',
              gap: '1px',
              gridTemplateColumns: '1fr 1fr',
              overflow: 'hidden',
            }}>
              <button
                type="button"
                onClick={handleToggleLike}
                disabled={liking}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: liked ? '#E06B75' : '#2A527A',
                  cursor: liking ? 'wait' : 'pointer',
                  padding: '16px',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '20px', fontWeight: 800 }}>{post.like_count || 0}</div>
                <div style={{ color: liked ? '#E06B75' : '#87ACCA', fontSize: '12px', marginTop: '4px' }}>
                  {liked ? '已喜歡' : '喜歡'}
                </div>
              </button>
              <div style={{ borderLeft: '1px solid rgba(194, 214, 230, 0.55)', padding: '16px', textAlign: 'center' }}>
                <div style={{ color: '#2A527A', fontSize: '20px', fontWeight: 800 }}>{post.comment_count || 0}</div>
                <div style={{ color: '#87ACCA', fontSize: '12px', marginTop: '4px' }}>留言</div>
              </div>
            </section>

            <section style={{ ...cardStyle, padding: '18px' }}>
              <div style={{
                alignItems: 'baseline',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                marginBottom: '14px',
              }}>
                <div>
                  <h2 style={{ color: '#2A527A', fontSize: '17px', margin: 0 }}>留言</h2>
                  <p style={{ color: '#87ACCA', fontSize: '13px', lineHeight: 1.7, margin: '6px 0 0' }}>
                    留下你對這條策展的回聲。
                  </p>
                </div>
                <span style={{ color: '#87ACCA', fontSize: '12px', flex: '0 0 auto' }}>
                  {post.comment_count || 0} 則
                </span>
              </div>

              <form onSubmit={handleSubmitCommentPreview} style={{ display: 'grid', gap: '10px' }}>
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  onFocus={() => {
                    if (!currentUser) {
                      setCommentMessage('登入後就能一起聊聊這條策展。');
                    }
                  }}
                  placeholder={currentUser ? '寫下你的回聲...' : '登入後一起聊聊'}
                  rows={3}
                  style={{
                    backgroundColor: '#F7FAFC',
                    border: '1px solid rgba(135, 172, 202, 0.55)',
                    borderRadius: '14px',
                    boxSizing: 'border-box',
                    color: '#2A527A',
                    fontSize: '14px',
                    lineHeight: 1.7,
                    outline: 'none',
                    padding: '12px 14px',
                    resize: 'vertical',
                    width: '100%',
                  }}
                />

                <div style={{
                  alignItems: 'center',
                  display: 'flex',
                  gap: '10px',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ color: '#87ACCA', fontSize: '12px' }}>
                    {commentDraft.trim().length}/2
                  </span>
                  <button
                    type={currentUser ? 'submit' : 'button'}
                    onClick={currentUser ? undefined : goToLoginForComment}
                    style={{
                      backgroundColor: '#2A527A',
                      border: 'none',
                      borderRadius: '999px',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 800,
                      padding: '9px 14px',
                    }}
                  >
                    {currentUser ? '送出留言' : '登入留言'}
                  </button>
                </div>
              </form>

              {commentMessage && (
                <div style={{
                  backgroundColor: '#F7FAFC',
                  border: '1px solid rgba(194, 214, 230, 0.65)',
                  borderRadius: '12px',
                  color: '#6B99C3',
                  fontSize: '13px',
                  lineHeight: 1.7,
                  marginTop: '12px',
                  padding: '10px 12px',
                }}>
                  {commentMessage}
                </div>
              )}

              <div style={{
                borderTop: '1px solid rgba(194, 214, 230, 0.55)',
                color: '#87ACCA',
                lineHeight: 1.8,
                marginTop: '16px',
                paddingTop: '18px',
                textAlign: 'center',
              }}>
                還沒有人留言。留下第一個回聲，之後會在這裡亮起來。
              </div>
            </section>
          </article>
        )}
      </main>
    </div>
  );
}
