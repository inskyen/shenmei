import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PageShell from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/requireLogin';
import { loadFollowedProfiles } from '@/lib/follows/profileFollows';

function getInitial(profile) {
  const name = profile.display_name || profile.username || '審';
  return name.charAt(0).toUpperCase();
}

export default function FollowingPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState([]);
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

        const result = await loadFollowedProfiles();
        setProfiles(result.profiles);
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
      title="關注"
      subtitle="這裡收著你想持續留意的策展人。"
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
        <div style={{ display: 'grid', gap: '12px' }}>
          {profiles.map((profile) => (
            <button
              key={profile.id}
              type="button"
              onClick={() => router.push(`/u/${profile.username}`)}
              style={{ alignItems: 'center', backgroundColor: '#F9FBFD', border: '1px solid #E3ECF4', borderRadius: '14px', cursor: 'pointer', display: 'flex', gap: '12px', padding: '12px', textAlign: 'left', width: '100%' }}
            >
              <span
                style={{ alignItems: 'center', backgroundColor: '#D9E4F5', backgroundImage: profile.avatar_url ? `url("${profile.avatar_url}")` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', borderRadius: '50%', color: '#6B99C3', display: 'flex', flexShrink: 0, fontSize: '18px', fontWeight: 800, height: '48px', justifyContent: 'center', width: '48px' }}
              >
                {!profile.avatar_url && getInitial(profile)}
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ color: '#2A527A', display: 'block', fontSize: '15px', fontWeight: 700 }}>
                  {profile.display_name || profile.username}
                </span>
                <span style={{ color: '#87ACCA', display: 'block', fontSize: '12px', marginTop: '3px' }}>
                  {profile.bio || `審美號：${profile.username}`}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </PageShell>
  );
}
