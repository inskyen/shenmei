import { useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { requireLogin } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';
import { showToast } from '@/lib/ui/toast';
import { createPostComment, loadPostComments } from '@/lib/comments/postComments';
import { cachePostDetail, getCachedPostDetail } from '@/lib/cache/postDetailCache';
import { loadProfileFollowState, toggleProfileFollow } from '@/lib/follows/profileFollows';
import { loadLikedPostIds, togglePostLike } from '@/lib/reactions/postLikes';

const pageStyle = {
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-primary)',
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
  return profile?.display_name || profile?.username || post?.legacy_added_by || '採樣人';
}

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '審';
}

function getCommentDisplayName(comment) {
  return comment.profile?.display_name || comment.profile?.username || '審美者';
}

function groupComments(comments) {
  const commentIds = new Set(comments.map((comment) => comment.id));
  const repliesByParent = new Map();
  const topLevelComments = [];

  comments.forEach((comment) => {
    if (!comment.parent_id || !commentIds.has(comment.parent_id)) {
      topLevelComments.push(comment);
      return;
    }

    const replies = repliesByParent.get(comment.parent_id) || [];
    replies.push(comment);
    repliesByParent.set(comment.parent_id, replies);
  });

  repliesByParent.forEach((replies) => {
    replies.sort((first, second) => new Date(first.created_at) - new Date(second.created_at));
  });

  return { topLevelComments, repliesByParent };
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
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [commentMessage, setCommentMessage] = useState('');
  const [replyTarget, setReplyTarget] = useState(null);
  const [isFollowingAuthor, setIsFollowingAuthor] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [videoDimension, setVideoDimension] = useState(null);
  const videoSectionRef = useRef(null);
  const videoResizeFrameRef = useRef(null);

  useEffect(() => {
    if (!id) return;

    async function loadPost() {
      const cachedDetail = getCachedPostDetail(id);

      if (cachedDetail) {
        setPost(cachedDetail.post);
        setProfile(cachedDetail.profile);
        setLoading(false);
      } else {
        setLoading(true);
      }
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
        setCommentsLoading(true);

        // 推薦者、所屬頻道、按讚狀態與登入身份彼此沒有依賴，
        // 同時讀取可縮短詳情頁從滑入到完整內容出現的等待時間。
        const profileRequest = postData.user_id
          ? supabase
            .from('profiles')
            .select('id, username, display_name, avatar_url')
            .eq('id', postData.user_id)
            .maybeSingle()
          : Promise.resolve({ data: null, error: null });

        const [profileResult, moduleResult, likedPostIds, user, commentRows] = await Promise.all([
          profileRequest,
          supabase
            .from('post_modules')
            .select('modules (id, slug, name)')
            .eq('post_id', postData.id),
          loadLikedPostIds([postData.id]),
          requireLogin({ silent: true }),
          loadPostComments(postData.id),
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
        setComments(commentRows);
        cachePostDetail(postData, profileResult.data || null);
        setIsFollowingAuthor(false);

        if (profileResult.data && profileResult.data.id !== user?.id) {
          loadProfileFollowState(profileResult.data.id)
            .then((followState) => setIsFollowingAuthor(followState.isFollowing))
            .catch((followError) => console.warn('作者追蹤狀態載入失敗:', followError));
        }

        if (postData?.videos?.external_id) {
          fetch(`/api/bilibili?bvid=${postData.videos.external_id}`)
            .then(res => res.json())
            .then(data => {
              if (data.dimension) {
                setVideoDimension(data.dimension);
              }
            })
            .catch(err => console.warn('無法獲取影片尺寸:', err));
        }
      } catch (error) {
        console.error('採樣動態載入失敗:', error);
        setErrorMessage('這條採樣動態暫時無法顯示，可能已被移除或尚未公開。');
      } finally {
        setCommentsLoading(false);
        if (!cachedDetail) {
          setLoading(false);
        }
      }
    }

    loadPost();
  }, [id]);

  useEffect(() => {
    const videoSection = videoSectionRef.current;
    if (!post || !videoSection || typeof window === 'undefined') return undefined;

    const updateVideoSize = () => {
      videoResizeFrameRef.current = null;
      // We removed the dynamic scroll-based shrinking here because it caused jitter
      // Now the video just takes its natural aspect ratio space or max height.
      const isPortraitVideo = Boolean(videoDimension && videoDimension.height > videoDimension.width);
      if (!isPortraitVideo) {
         videoSection.style.paddingTop = '56.25%';
         videoSection.style.height = '0';
      } else {
         videoSection.style.paddingTop = '0';
         videoSection.style.height = '75vh';
         videoSection.style.maxHeight = '800px';
      }
    };

    const scheduleVideoResize = () => {
      if (videoResizeFrameRef.current) return;
      videoResizeFrameRef.current = window.requestAnimationFrame(updateVideoSize);
    };

    updateVideoSize();
    window.addEventListener('resize', scheduleVideoResize);

    return () => {
      window.removeEventListener('resize', scheduleVideoResize);
      if (videoResizeFrameRef.current) {
        window.cancelAnimationFrame(videoResizeFrameRef.current);
        videoResizeFrameRef.current = null;
      }
    };
  }, [post, videoDimension]);

  const video = post?.videos || {};
  const displayName = getDisplayName(post, profile);
  const { topLevelComments, repliesByParent } = groupComments(comments);

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
        message: '請先登入，才能採樣。',
      });

      if (user) {
        router.push('/submit');
      }
    } catch (error) {
      console.error('登入狀態檢查失敗:', error);
      showToast('登入狀態確認失敗，請稍後再試。');
    }
  };

  const goToLoginForComment = async (message = '請先登入，才能留言。') => {
    try {
      await requireLogin({
        router,
        nextPath: router.asPath,
        message,
      });
    } catch (error) {
      console.error('登入狀態檢查失敗:', error);
      setCommentMessage('登入狀態確認失敗，請稍後再試。');
    }
  };

  const handleSubmitComment = async (event) => {
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

    if (!post?.id || commentSubmitting) {
      return;
    }

    setCommentSubmitting(true);

    try {
      const result = await createPostComment({
        postId: post.id,
        content: commentDraft,
        parentId: replyTarget?.id || null,
      });

      if (result.requiresLogin) {
        setCurrentUser(null);
        await goToLoginForComment();
        return;
      }

      setComments((currentComments) => (
        replyTarget ? [...currentComments, result.comment] : [result.comment, ...currentComments]
      ));
      setPost((currentPost) => ({
        ...currentPost,
        comment_count: (currentPost.comment_count || 0) + 1,
      }));
      setCommentDraft('');
      setReplyTarget(null);
      showToast(replyTarget ? '回覆已送出。' : '留言已送出。');
    } catch (error) {
      console.error('留言送出失敗:', error);
      setCommentMessage('留言送出失敗，請稍後再試。');
    } finally {
      setCommentSubmitting(false);
    }
  };

  const handleReply = async (comment) => {
    if (!currentUser) {
      await goToLoginForComment('請先登入，才能回覆留言。');
      return;
    }

    setReplyTarget(comment);
    setCommentMessage('');
    window.setTimeout(() => document.getElementById('comment-input')?.focus(), 0);
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
          message: '請先登入，才能喜歡這條採樣。',
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

  const handleToggleAuthorFollow = async () => {
    if (!profile?.id || followLoading || currentUser?.id === profile.id) {
      return;
    }

    const user = await requireLogin({
      router,
      nextPath: router.asPath,
      message: '請先登入以關注作者。',
    });

    if (!user) return;

    setFollowLoading(true);

    try {
      const result = await toggleProfileFollow(profile.id);
      if (result.requiresLogin || result.isOwnProfile) return;

      setIsFollowingAuthor(result.isFollowing);
      showToast(result.isFollowing ? '已關注作者。' : '已取消關注。');
    } catch (error) {
      console.error('關注作者失敗:', error);
      showToast('關注狀態暫時無法更新，請稍後再試。');
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div className="app-detail-page" style={pageStyle}>
      <Head>
        <title>{post ? `${video.title || '採樣動態'} · 審美者` : '採樣動態 · 審美者'}</title>
      </Head>

      <main style={{ margin: '0 auto', maxWidth: '600px' }}>
        {loading && (
          <div style={{ display: 'grid', gap: '18px', padding: '84px 16px 28px' }}>
            <div className="app-detail-skeleton" style={{ height: '260px', borderRadius: '8px' }} />
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className="app-detail-skeleton" style={{ height: '20px', width: '42%' }} />
              <div className="app-detail-skeleton" style={{ height: '14px', width: '76%' }} />
              <div className="app-detail-skeleton" style={{ height: '14px', width: '64%' }} />
            </div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '13px', paddingTop: '6px', textAlign: 'center' }}>
              正在打開這篇採樣...
            </div>
          </div>
        )}

        {!loading && errorMessage && (
          <div style={{ padding: '100px 20px', textAlign: 'center', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
            {errorMessage}
          </div>
        )}

        {!loading && post && (
          <article style={{ display: 'flex', flexDirection: 'column' }}>
            {/* 顶部悬浮视频区 */}
            <section ref={videoSectionRef} style={{
              backgroundColor: 'var(--bg-base)',
              position: 'sticky',
              top: 0,
              zIndex: 40,
              width: '100%',
              willChange: 'height',
              ...(videoDimension && videoDimension.height > videoDimension.width ? {
                height: '75vh',
                maxHeight: '800px',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              } : {
                paddingTop: '56.25%',
                boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
              })
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
                  color: 'var(--text-tertiary)',
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
                      backgroundColor: 'var(--bg-base)',
                      backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none',
                      backgroundPosition: 'center',
                      backgroundSize: 'cover',
                      borderRadius: '50%',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      fontWeight: 500,
                      height: '42px',
                      justifyContent: 'center',
                      width: '42px',
                      border: '1px solid var(--border-light)'
                    }}
                  >
                    {profile?.avatar_url ? '' : getInitial(displayName)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '15px' }}>{displayName}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '400' }}>· INFP</span>
                    </div>
                    <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '2px' }}>
                      {formatDate(post.created_at)}
                    </div>
                  </div>
                </div>
                {profile && currentUser?.id !== profile.id && (
                  <button
                    type="button"
                    onClick={handleToggleAuthorFollow}
                    disabled={followLoading}
                    style={{
                      border: `1px solid ${isFollowingAuthor ? 'var(--border-light)' : 'var(--brand-blue)'}`,
                      color: isFollowingAuthor ? 'var(--text-secondary)' : 'var(--brand-blue)',
                      backgroundColor: isFollowingAuthor ? 'var(--brand-blue-light)' : 'transparent',
                      borderRadius: '6px',
                      padding: '4px 16px',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: followLoading ? 'wait' : 'pointer',
                      opacity: followLoading ? 0.7 : 1,
                    }}
                  >
                    {followLoading ? '處理中' : isFollowingAuthor ? '已關注' : '關注'}
                  </button>
                )}
              </div>

              {/* 標題 */}
              <h1 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600', lineHeight: 1.5, margin: '0 0 12px 0' }}>
                {video.title || '未命名影片'}
              </h1>

              {/* 正文 */}
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap', letterSpacing: '0.2px' }}>
                {post.note}
              </p>

              {/* 模块标签 */}
              {modules.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '20px' }}>
                  {modules.map((module) => (
                    <div
                      key={module.id}
                      onClick={() => router.push(`/m/${module.slug}`)}
                      style={{
                        backgroundColor: 'var(--brand-blue-light)',
                        color: 'var(--brand-blue)',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: 500,
                        padding: '4px 10px',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px'
                      }}
                    >
                      <span style={{ color: 'var(--brand-blue)', opacity: 0.8 }}>#</span> {module.name}
                    </div>
                  ))}
                </div>
              )}
              
              <div style={{ margin: '30px 0', height: '1px', backgroundColor: 'var(--border-light)' }}></div>

              {/* 留言區頂部 */}
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
                共 {post.comment_count || 0} 條留言
              </div>

              {commentsLoading && (
                <div style={{ display: 'grid', gap: '18px', padding: '8px 0 26px' }}>
                  {[0, 1].map((index) => (
                    <div key={index} style={{ display: 'flex', gap: '10px' }}>
                      <div className="app-detail-skeleton" style={{ borderRadius: '50%', height: '34px', width: '34px' }} />
                      <div style={{ display: 'grid', flex: 1, gap: '8px' }}>
                        <div className="app-detail-skeleton" style={{ height: '12px', width: '94px' }} />
                        <div className="app-detail-skeleton" style={{ height: '13px', width: index === 0 ? '86%' : '62%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!commentsLoading && comments.length === 0 && (
                <div style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '40px 0', fontSize: '14px' }}>
                  還沒有人留言，來做第一個發聲的人吧。
                </div>
              )}

              {!commentsLoading && comments.length > 0 && (
                <div style={{ display: 'grid', gap: '22px', paddingBottom: '22px' }}>
                  {topLevelComments.map((comment) => {
                    const commentDisplayName = getCommentDisplayName(comment);
                    const replies = repliesByParent.get(comment.id) || [];

                    return (
                      <div key={comment.id}>
                        <article style={{ display: 'flex', gap: '10px' }}>
                          <div
                            aria-label={commentDisplayName}
                            style={{
                              alignItems: 'center',
                              backgroundColor: 'var(--bg-base)',
                              backgroundImage: comment.profile?.avatar_url ? `url(${comment.profile.avatar_url})` : 'none',
                              backgroundPosition: 'center',
                              backgroundSize: 'cover',
                              borderRadius: '50%',
                              color: 'var(--text-secondary)',
                              display: 'flex',
                              flex: '0 0 auto',
                              fontSize: '13px',
                              fontWeight: 500,
                              height: '34px',
                              justifyContent: 'center',
                              width: '34px',
                              border: '1px solid var(--border-light)'
                            }}
                          >
                            {comment.profile?.avatar_url ? '' : getInitial(commentDisplayName)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ alignItems: 'baseline', display: 'flex', gap: '8px' }}>
                              <span style={{ color: 'var(--brand-blue)', fontSize: '13px', fontWeight: '500' }}>{commentDisplayName}</span>
                              <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{formatDate(comment.created_at)}</span>
                            </div>
                            <p style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: 1.7, margin: '5px 0 0', whiteSpace: 'pre-wrap' }}>
                              {comment.content}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleReply(comment)}
                              style={{ background: 'transparent', border: 'none', color: 'var(--brand-blue)', cursor: 'pointer', fontSize: '12px', marginTop: '4px', padding: 0 }}
                            >
                              回覆
                            </button>
                          </div>
                        </article>

                        {replies.length > 0 && (
                          <div style={{ borderLeft: '2px solid var(--border-light)', display: 'grid', gap: '14px', margin: '12px 0 0 43px', paddingLeft: '12px' }}>
                            {replies.map((reply) => {
                               const replyDisplayName = getCommentDisplayName(reply);

                               return (
                                 <article key={reply.id} style={{ display: 'flex', gap: '8px' }}>
                                   <div
                                     aria-label={replyDisplayName}
                                     style={{ alignItems: 'center', backgroundColor: 'var(--bg-base)', backgroundImage: reply.profile?.avatar_url ? `url(${reply.profile.avatar_url})` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', borderRadius: '50%', color: 'var(--text-secondary)', display: 'flex', flex: '0 0 auto', fontSize: '11px', fontWeight: 500, height: '28px', justifyContent: 'center', width: '28px', border: '1px solid var(--border-light)' }}
                                   >
                                     {reply.profile?.avatar_url ? '' : getInitial(replyDisplayName)}
                                   </div>
                                   <div style={{ minWidth: 0 }}>
                                     <div style={{ alignItems: 'baseline', display: 'flex', gap: '7px' }}>
                                       <span style={{ color: 'var(--brand-blue)', fontSize: '12px', fontWeight: '500' }}>{replyDisplayName}</span>
                                       <span style={{ color: 'var(--text-tertiary)', fontSize: '11px' }}>{formatDate(reply.created_at)}</span>
                                     </div>
                                     <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{reply.content}</p>
                                     <button
                                       type="button"
                                       onClick={() => handleReply(comment)}
                                       style={{ background: 'transparent', border: 'none', color: 'var(--brand-blue)', cursor: 'pointer', fontSize: '12px', marginTop: '3px', padding: 0 }}
                                     >
                                       回覆
                                     </button>
                                   </div>
                                 </article>
                               );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            </section>
          </article>
        )}
      </main>

      {/* 底部懸浮互動欄 (Floating Island style) */}
      {!loading && post && (
        <div style={{
          position: 'fixed',
          bottom: 'max(24px, env(safe-area-inset-bottom))',
          left: '16px',
          right: '16px',
          margin: '0 auto',
          maxWidth: '568px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: '99px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          zIndex: 50,
          transition: 'border-radius 0.2s',
          ...(replyTarget ? { borderRadius: '24px', alignItems: 'flex-end', padding: '12px 16px' } : {})
        }}>
          {/* 輸入框 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {replyTarget && (
              <div style={{ alignItems: 'center', color: 'var(--brand-blue)', display: 'flex', fontSize: '12px', gap: '6px', margin: '0 4px 5px' }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  回覆 @{getCommentDisplayName(replyTarget)}
                </span>
                <button
                  type="button"
                  onClick={() => setReplyTarget(null)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', fontSize: '15px', lineHeight: 1, padding: 0 }}
                  aria-label="取消回覆"
                >
                  ×
                </button>
              </div>
            )}
            <div
              onClick={currentUser ? () => document.getElementById('comment-input')?.focus() : goToLoginForComment}
              style={{
                alignItems: 'center',
                backgroundColor: 'var(--bg-base)',
                borderRadius: '6px',
                cursor: 'text',
                display: 'flex',
                padding: '8px 16px',
              }}
            >
              <input
                id="comment-input"
                type="text"
                placeholder={currentUser ? (replyTarget ? `回覆 @${getCommentDisplayName(replyTarget)}` : '說點什麼...') : '登入後一起聊聊'}
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmitComment(e)}
                disabled={commentSubmitting}
                style={{
                  border: 'none',
                  background: 'transparent',
                  outline: 'none',
                  width: '100%',
                  fontSize: '14px',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          {/* 右側按鈕群 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px', color: 'var(--text-secondary)' }}>
            <div 
              onClick={handleToggleLike}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: liking ? 'wait' : 'pointer', color: liked ? '#FF4D4F' : 'var(--text-secondary)' }}
            >
              <svg style={{ width: '24px', height: '24px' }} fill={liked ? 'currentColor' : 'none'} stroke={liked ? '#FF4D4F' : 'currentColor'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{post.like_count || '讚'}</span>
            </div>
            
            <div onClick={currentUser ? () => document.getElementById('comment-input')?.focus() : goToLoginForComment} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
              <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
              <span style={{ fontSize: '13px', fontWeight: 500 }}>{post.comment_count || '評論'}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
               <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
            </div>
          </div>
        </div>
      )}

      {/* 提示訊息 */}
      {commentMessage && (
        <div style={{ position: 'fixed', bottom: '100px', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--text-primary)', color: 'var(--bg-surface)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', zIndex: 60 }}>
          {commentMessage}
        </div>
      )}
    </div>
  );
}
