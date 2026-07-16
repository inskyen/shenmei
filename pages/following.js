import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import PageShell from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/requireLogin';
import { getCachedFollowingFeed, prefetchFollowingFeed, cacheFollowingFeed } from '@/lib/cache/followingFeedCache';

function getInitial(profile) {
  const name = profile.display_name || profile.username || '審';
  return name.charAt(0).toUpperCase();
}

function formatDate(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function FollowingPage() {
  const router = useRouter();

  // 優先用緩存初始化，有緩存就跳過 loading
  const cached = getCachedFollowingFeed();
  const [profiles, setProfiles] = useState(() => cached?.profiles || []);
  const [posts, setPosts] = useState(() => cached?.posts || []);
  const [loading, setLoading] = useState(() => !cached);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadFollowing() {
      setErrorMessage('');

      try {
        const user = await requireLogin({
          router,
          nextPath: '/following',
          message: '請先登入，才能查看您的關注名單。',
          replace: true,
        });

        if (!user) return;

        // 有緩存就先顯示，不阻塞，同時背景刷新
        const hit = getCachedFollowingFeed();
        if (hit) {
          setProfiles(hit.profiles);
          setPosts(hit.posts);
          setLoading(false);
          // 背景靜默刷新（不觸發 loading 動畫）
          prefetchFollowingFeed({ force: true })
            .then((fresh) => {
              setProfiles(fresh.profiles);
              setPosts(fresh.posts);
              cacheFollowingFeed(fresh);
            })
            .catch(() => {});
          return;
        }

        // 沒有緩存才進 loading
        setLoading(true);
        const result = await prefetchFollowingFeed({ force: true });
        setProfiles(result.profiles);
        setPosts(result.posts);
      } catch (error) {
        console.error('關注名單載入失敗:', error);
        setErrorMessage('關注名單暫時無法顯示，請稍後再試。');
      } finally {
        setLoading(false);
      }
    }

    loadFollowing();
  }, [router]);

  return (
    <>
      <PageShell
        title="關注動態"
        subtitle="只收下您想持續留意的人，剛剛發出的審美。"
      >
      {loading && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {[1, 2, 3].map((item) => (
            <div key={item} className="app-detail-skeleton" style={{ borderRadius: '6px', height: '76px' }} />
          ))}
        </div>
      )}

      {!loading && errorMessage && (
        <p style={{ color: '#FF4D4F', lineHeight: 1.7, margin: 0 }}>{errorMessage}</p>
      )}

      {!loading && !errorMessage && profiles.length === 0 && (
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, textAlign: 'center', padding: '28px 8px' }}>
          <p style={{ margin: '0 0 16px' }}>您還沒有關注任何採樣人。</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{ backgroundColor: 'var(--brand-blue)', border: 'none', borderRadius: '6px', color: '#FFFFFF', cursor: 'pointer', fontSize: '14px', fontWeight: 500, padding: '10px 18px', transition: 'all 0.2s' }}
          >
            去首頁逛逛
          </button>
        </div>
      )}

      {!loading && !errorMessage && profiles.length > 0 && (
        <div>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => router.push(`/u/${profile.username}`)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', flex: '0 0 58px', padding: 0, textAlign: 'center' }}
              >
                <span
                  style={{ alignItems: 'center', backgroundColor: 'var(--bg-base)', backgroundImage: profile.avatar_url ? `url("${profile.avatar_url}")` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', border: '1px solid var(--border-light)', borderRadius: '50%', color: 'var(--text-secondary)', display: 'flex', fontSize: '16px', fontWeight: 600, height: '48px', justifyContent: 'center', margin: '0 auto 5px', width: '48px' }}
                >
                  {!profile.avatar_url && getInitial(profile)}
                </span>
                <span style={{ display: 'block', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile.display_name || profile.username}
                </span>
              </button>
            ))}
          </div>

          {posts.length === 0 && (
            <div style={{ color: 'var(--text-tertiary)', lineHeight: 1.8, padding: '24px 8px', textAlign: 'center' }}>
              您關注的採樣人最近還沒有新的採樣。
            </div>
          )}

          {posts.length > 0 && (
            <div style={{ display: 'grid', gap: '14px' }}>
              {posts.map((post) => {
                const video = post.videos || {};
                const profile = post.profile || {};

                return (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => router.push(`/p/${post.id}`)}
                    style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '8px', cursor: 'pointer', display: 'flex', gap: '12px', overflow: 'hidden', padding: '10px', textAlign: 'left', width: '100%' }}
                  >
                    <span style={{ backgroundColor: 'var(--bg-base)', backgroundImage: video.cover_url ? `url("${video.cover_url}")` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', borderRadius: '4px', border: '1px solid var(--border-light)', display: 'block', flex: '0 0 88px', height: '112px' }} />
                    <span style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, padding: '2px 2px 1px 0' }}>
                      <span style={{ alignItems: 'center', color: 'var(--text-secondary)', display: 'flex', fontSize: '12px', gap: '6px' }}>
                        <span style={{ alignItems: 'center', backgroundColor: 'var(--bg-base)', backgroundImage: profile.avatar_url ? `url("${profile.avatar_url}")` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', borderRadius: '50%', border: '1px solid var(--border-light)', display: 'flex', flex: '0 0 auto', fontSize: '9px', fontWeight: 600, height: '18px', justifyContent: 'center', width: '18px', color: 'var(--text-secondary)' }}>
                          {!profile.avatar_url && getInitial(profile)}
                        </span>
                        {profile.display_name || profile.username || '採樣人'}
                        <span style={{ color: 'var(--text-tertiary)' }}>{formatDate(post.created_at)}</span>
                      </span>
                      <span style={{ color: 'var(--text-primary)', display: '-webkit-box', fontSize: '14px', fontWeight: 600, lineHeight: 1.45, marginTop: '8px', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                        {video.title || '未命名影片'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)', display: '-webkit-box', fontSize: '13px', lineHeight: 1.55, marginTop: '5px', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                        {post.note}
                      </span>
                      <span style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginTop: 'auto', paddingTop: '8px' }}>
                        {post.like_count || 0} 讚 · {post.comment_count || 0} 留言
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      </PageShell>
      <AppBottomNav active="following" />
    </>
  );
}
