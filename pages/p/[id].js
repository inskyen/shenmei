import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { requireLogin } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';
import { showToast } from '@/lib/ui/toast';
import { loadLikedPostIds, togglePostLike } from '@/lib/reactions/postLikes';

const pageStyle = {
  backgroundColor: '#FFFFFF',
  color: '#2A3F54',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  minHeight: '100vh',
  paddingBottom: '80px',
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

        // 推薦者、所屬小館、按讚狀態與登入身份彼此沒有依賴，
        // 同時讀取可縮短詳情頁從滑入到完整內容出現的等待時間。
        const profileRequest = postData.user_id
          ? supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('id', postData.user_id)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null });

        const [profileResult, moduleResult, likedPostIds, user] = await Promise.all([
          profileRequest,
          supabase
            .from('post_modules')
            .select('modules (id, slug, name)')
            .eq('post_id', postData.id),
          loadLikedPostIds([postData.id]),
          requireLogin({ silent: true }),
        ]);

        if (profileResult.error) {
          throw profileResult.error;
        }

        if (moduleResult.error) {
          throw moduleResult.error;
        }

        setProfile(profileResult.data || null);
        setModules((moduleResult.data || []).map((row) => row.modules).filter(Boolean));
        setLiked(likedPostIds.has(postData.id));
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

  const goBack = () => {
    // 從首頁或影片頁點進來時回到原本的畫面；使用者直接開連結時才回首頁。
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
  };

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
      showToast('登入狀態確認失敗，請稍後再試。');
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
      showToast('喜歡操作失敗，請稍後再試。');
    } finally {
      setLiking(false);
    }
  };

  return (
    <div className="app-detail-page" style={pageStyle}>
      <Head>
        <title>{post ? `${video.title || '策展動態'} · 審美者` : '策展動態 · 審美者'}</title>
      </Head>

      <header style={{
        alignItems: 'center',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '16px',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
      }}>
        <button
          type="button"
          onClick={goBack}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#2A3F54',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255, 255, 255, 0.65)',
            borderRadius: '50%',
            backdropFilter: 'blur(10px)',
          }}
        >
          <svg style={{ width: '22px', height: '22px' }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"></path></svg>
        </button>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={goToSubmit}
            style={{
              backgroundColor: '#6B99C3',
              border: 'none',
              borderRadius: '999px',
              color: '#FFFFFF',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              padding: '6px 16px',
              boxShadow: '0 2px 8px rgba(107, 153, 195, 0.3)',
            }}
          >
            發佈
          </button>
        </div>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '600px' }}>
        {loading && (
          <div style={{ display: 'grid', gap: '18px', padding: '84px 16px 28px' }}>
            <div className="app-detail-skeleton" style={{ height: '260px', borderRadius: 0 }} />
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className="app-detail-skeleton" style={{ height: '20px', width: '42%' }} />
              <div className="app-detail-skeleton" style={{ height: '14px', width: '76%' }} />
              <div className="app-detail-skeleton" style={{ height: '14px', width: '64%' }} />
            </div>
            <div style={{ color: '#87ACCA', fontSize: '13px', paddingTop: '6px', textAlign: 'center' }}>
              正在打開這篇策展...
            </div>
          </div>
        )}

        {!loading && errorMessage && (
          <div style={{ padding: '100px 20px', textAlign: 'center', color: '#87ACCA', lineHeight: 1.8 }}>
            {errorMessage}
          </div>
        )}

        {!loading && post && (
          <article style={{ display: 'flex', flexDirection: 'column' }}>
            {/* 顶部满铺视频/图片区 */}
            <section style={{
              backgroundColor: '#F4F7FA',
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
                  color: '#9AA6B2',
                  display: 'flex',
                  inset: 0,
                  justifyContent: 'center',
                  position: 'absolute',
                }}>
                  影片暫時無法播放
                </div>
              )}
            </section>

            {/* 内容区 */}
            <section style={{ padding: '20px 16px' }}>
              {/* 用户信息 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    aria-label={displayName}
                    style={{
                      alignItems: 'center',
                      backgroundColor: '#D9E4F5',
                      backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none',
                      backgroundPosition: 'center',
                      backgroundSize: 'cover',
                      borderRadius: '50%',
                      color: '#6B99C3',
                      display: 'flex',
                      fontWeight: 800,
                      height: '42px',
                      justifyContent: 'center',
                      width: '42px',
                      border: '1px solid #E8EFF5'
                    }}
                  >
                    {profile?.avatar_url ? '' : getInitial(displayName)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#2A3F54', fontWeight: 600, fontSize: '15px' }}>{displayName}</span>
                      <span style={{ backgroundColor: '#D9E4F5', color: '#6B99C3', fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>INFP</span>
                    </div>
                    <div style={{ color: '#9AA6B2', fontSize: '12px', marginTop: '2px' }}>
                      {formatDate(post.created_at)}
                    </div>
                  </div>
                </div>
                <button style={{ border: '1px solid #6B99C3', color: '#6B99C3', backgroundColor: 'transparent', borderRadius: '99px', padding: '4px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  關注
                </button>
              </div>

              {/* 标题 */}
              <h1 style={{ color: '#2A3F54', fontSize: '20px', fontWeight: 'bold', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                {video.title || '未命名影片'}
              </h1>

              {/* 正文 */}
              <p style={{ color: '#2A3F54', fontSize: '15px', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap', letterSpacing: '0.3px' }}>
                {post.note}
              </p>

              {/* 模块标签 */}
              {modules.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
                  {modules.map((module) => (
                    <div
                      key={module.id}
                      onClick={() => router.push(`/m/${module.slug}`)}
                      style={{
                        backgroundColor: '#F4F7FA',
                        color: '#6B99C3',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: 500,
                        padding: '6px 14px',
                        borderRadius: '99px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <span style={{ color: '#6B99C3', opacity: 0.8 }}>#</span> {module.name}
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ margin: '30px 0', height: '1px', backgroundColor: '#E8EFF5' }}></div>

              {/* 留言區頂部 */}
              <div style={{ color: '#9AA6B2', fontSize: '13px', marginBottom: '20px' }}>
                共 {post.comment_count || 0} 條留言
              </div>
              <div style={{ color: '#9AA6B2', textAlign: 'center', padding: '40px 0', fontSize: '14px' }}>
                還沒有人留言，來做第一個發聲的人吧。
              </div>

            </section>
          </article>
        )}
      </main>

      {/* 底部吸底互動欄 (Xiaohongshu style) */}
      {!loading && post && (
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid #E8EFF5',
          padding: '10px 16px',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          zIndex: 40,
        }}>
          {/* 輸入框 */}
          <div 
            onClick={currentUser ? () => document.getElementById('comment-input')?.focus() : goToLoginForComment}
            style={{
              flex: 1,
              backgroundColor: '#F4F7FA',
              borderRadius: '99px',
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              cursor: 'text'
            }}
          >
            <input 
              id="comment-input"
              type="text"
              placeholder="說點什麼..."
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmitCommentPreview(e)}
              style={{
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontSize: '14px',
                color: '#2A3F54'
              }}
            />
          </div>

          {/* 右側按鈕群 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', color: '#9AA6B2' }}>
            <div 
              onClick={handleToggleLike}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: liking ? 'wait' : 'pointer', color: liked ? '#D98C8C' : '#9AA6B2' }}
            >
              <svg style={{ width: '28px', height: '28px' }} fill={liked ? 'currentColor' : 'none'} stroke={liked ? '#D98C8C' : 'currentColor'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{post.like_count || '讚'}</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              <span style={{ fontSize: '13px', fontWeight: 600 }}>{post.comment_count || '評論'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
               <svg style={{ width: '28px', height: '28px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            </div>
          </div>
        </div>
      )}

      {/* 提示訊息 */}
      {commentMessage && (
        <div style={{ position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(42, 63, 84, 0.9)', color: '#FFF', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', zIndex: 60 }}>
          {commentMessage}
        </div>
      )}
    </div>
  );
}
