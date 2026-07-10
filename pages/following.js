import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PageShell from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/requireLogin';
import { loadFollowingFeed } from '@/lib/follows/profileFollows';

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
  const [profiles, setProfiles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadFollowing() {
      setLoading(true);
      setErrorMessage('');

      try {
        const user = await requireLogin({
          router,
          nextPath: '/following',
          message: '請先登入，才能查看你的關注名單。',
          replace: true,
        });

        if (!user) return;

        const result = await loadFollowingFeed();
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
    <PageShell
      title="關注動態"
      subtitle="只收下你想持續留意的人，剛剛發出的審美。"
    >
      {loading && (
        <div style={{ display: 'grid', gap: '12px' }}>
          {[1, 2, 3].map((item) => (
            <div key={item} className="app-detail-skeleton" style={{ borderRadius: '14px', height: '76px' }} />
          ))}
        </div>
      )}

      {!loading && errorMessage && (
        <p style={{ color: '#9F5E4C', lineHeight: 1.7, margin: 0 }}>{errorMessage}</p>
      )}

      {!loading && !errorMessage && profiles.length === 0 && (
        <div style={{ color: '#87ACCA', lineHeight: 1.8, textAlign: 'center', padding: '28px 8px' }}>
          <p style={{ margin: '0 0 16px' }}>你還沒有關注任何策展人。</p>
          <button
            type="button"
            onClick={() => router.push('/')}
            style={{ backgroundColor: '#6B99C3', border: 'none', borderRadius: '99px', color: '#FFFFFF', cursor: 'pointer', fontSize: '14px', fontWeight: 600, padding: '10px 18px' }}
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
                style={{ background: 'transparent', border: 'none', color: '#52769A', cursor: 'pointer', flex: '0 0 58px', padding: 0, textAlign: 'center' }}
              >
                <span
                  style={{ alignItems: 'center', backgroundColor: '#D9E4F5', backgroundImage: profile.avatar_url ? `url("${profile.avatar_url}")` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', border: '2px solid #FFFFFF', borderRadius: '50%', boxShadow: '0 2px 8px rgba(42, 82, 122, 0.1)', color: '#6B99C3', display: 'flex', fontSize: '18px', fontWeight: 800, height: '48px', justifyContent: 'center', margin: '0 auto 5px', width: '48px' }}
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
            <div style={{ color: '#87ACCA', lineHeight: 1.8, padding: '24px 8px', textAlign: 'center' }}>
              你關注的策展人最近還沒有發布新動態。
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
                    style={{ backgroundColor: '#F9FBFD', border: '1px solid #E3ECF4', borderRadius: '16px', cursor: 'pointer', display: 'flex', gap: '12px', overflow: 'hidden', padding: '10px', textAlign: 'left', width: '100%' }}
                  >
                    <span style={{ backgroundColor: '#E1E9F0', backgroundImage: video.cover_url ? `url("${video.cover_url}")` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', borderRadius: '10px', display: 'block', flex: '0 0 88px', height: '112px' }} />
                    <span style={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0, padding: '2px 2px 1px 0' }}>
                      <span style={{ alignItems: 'center', color: '#52769A', display: 'flex', fontSize: '12px', gap: '6px' }}>
                        <span style={{ alignItems: 'center', backgroundColor: '#D9E4F5', backgroundImage: profile.avatar_url ? `url("${profile.avatar_url}")` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', borderRadius: '50%', display: 'flex', flex: '0 0 auto', fontSize: '9px', fontWeight: 700, height: '18px', justifyContent: 'center', width: '18px' }}>
                          {!profile.avatar_url && getInitial(profile)}
                        </span>
                        {profile.display_name || profile.username || '策展人'}
                        <span style={{ color: '#AAB8C5' }}>{formatDate(post.created_at)}</span>
                      </span>
                      <span style={{ color: '#2A527A', display: '-webkit-box', fontSize: '14px', fontWeight: 700, lineHeight: 1.45, marginTop: '8px', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                        {video.title || '未命名影片'}
                      </span>
                      <span style={{ color: '#4A6984', display: '-webkit-box', fontSize: '13px', lineHeight: 1.55, marginTop: '5px', overflow: 'hidden', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2 }}>
                        {post.note}
                      </span>
                      <span style={{ color: '#87ACCA', fontSize: '11px', marginTop: 'auto', paddingTop: '8px' }}>
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
  );
}
