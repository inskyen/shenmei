import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import { getCachedModulePage, prefetchModulePage } from '@/lib/cache/modulePageCache';

const pageStyle = {
  backgroundColor: '#F4F7FA',
  color: '#2A3F54',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  minHeight: '100vh',
};

function formatDate(timestamp) {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const minutesAgo = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutesAgo >= 0 && minutesAgo < 60) return `${minutesAgo} 分鐘前`;

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getDisplayName(post, profile) {
  return profile?.display_name || profile?.username || post.legacy_added_by || '策展人';
}

function getInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '審';
}

function ModulePostCard({ post, profile, router }) {
  const video = post.videos || {};
  const displayName = getDisplayName(post, profile);

  return (
    <article style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E8EFF5', padding: '12px 0' }}>
      <button
        type="button"
        onClick={() => router.push(`/p/${post.id}`)}
        style={{ alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', marginBottom: '8px', padding: '0 16px', textAlign: 'left', width: '100%' }}
      >
        <span style={{ alignItems: 'center', display: 'flex', gap: '8px', minWidth: 0 }}>
          <span
            style={{ alignItems: 'center', backgroundColor: '#D9E4F5', backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', border: '1px solid #E8EFF5', borderRadius: '50%', color: '#6B99C3', display: 'flex', flex: '0 0 auto', fontSize: '12px', fontWeight: 700, height: '28px', justifyContent: 'center', overflow: 'hidden', width: '28px' }}
          >
            {!profile?.avatar_url && getInitial(displayName)}
          </span>
          <span style={{ alignItems: 'center', display: 'flex', gap: '6px', minWidth: 0 }}>
            <span style={{ color: '#2A3F54', fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
            <span style={{ color: '#9AA6B2', flex: '0 0 auto', fontSize: '11px' }}>· {formatDate(post.created_at)}</span>
          </span>
        </span>
        <span style={{ color: '#C2D6E6', fontSize: '18px', lineHeight: 1 }}>⋮</span>
      </button>

      <button
        type="button"
        onClick={() => router.push(`/v/${video.id}`)}
        aria-label={`開啟影片：${video.title || '未命名影片'}`}
        style={{ backgroundColor: '#E1E9F0', backgroundImage: video.cover_url ? `url(${video.cover_url})` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', border: 'none', cursor: 'pointer', display: 'block', marginBottom: '8px', paddingTop: '42.8%', position: 'relative', width: '100%' }}
      >
        <span style={{ alignItems: 'center', backdropFilter: 'blur(6px)', backgroundColor: 'rgba(255, 255, 255, 0.5)', border: '1px solid rgba(255,255,255,0.7)', borderRadius: '50%', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', display: 'flex', height: '42px', justifyContent: 'center', left: '50%', position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', width: '42px' }}>
          <span style={{ borderBottom: '8px solid transparent', borderLeft: '12px solid #FFFFFF', borderTop: '8px solid transparent', height: 0, marginLeft: '5px', width: 0 }} />
        </span>
      </button>

      <button
        type="button"
        onClick={() => router.push(`/p/${post.id}`)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'block', marginBottom: '8px', padding: '0 16px', textAlign: 'left', width: '100%' }}
      >
        <p style={{ WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, color: '#2A3F54', display: '-webkit-box', fontSize: '14px', letterSpacing: '0.3px', lineHeight: 1.5, margin: 0, overflow: 'hidden', wordBreak: 'break-word' }}>
          {post.note || video.title || '這支影片還在等一段推薦理由。'}
        </p>
      </button>

      <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
        <button
          type="button"
          onClick={() => router.push(`/v/${video.id}`)}
          style={{ alignItems: 'center', backgroundColor: '#F4F7FA', border: 'none', borderRadius: '99px', color: '#6B99C3', cursor: 'pointer', display: 'inline-flex', fontSize: '11px', fontWeight: 500, gap: '4px', maxWidth: '60%', overflow: 'hidden', padding: '4px 10px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.title || '影片資料'}</span>
        </button>
        <button
          type="button"
          onClick={() => router.push(`/p/${post.id}`)}
          style={{ alignItems: 'center', background: 'transparent', border: 'none', color: '#9AA6B2', cursor: 'pointer', display: 'flex', fontSize: '12px', gap: '14px', padding: 0 }}
        >
          <span>留言 {post.comment_count || 0}</span>
          <span>♡ {post.like_count || 0}</span>
        </button>
      </div>
    </article>
  );
}

export default function ModuleDetailPage() {
  const router = useRouter();
  const { slug } = router.query;
  const cachedPage = slug ? getCachedModulePage(slug) : null;
  const [module, setModule] = useState(() => cachedPage?.module || null);
  const [posts, setPosts] = useState(() => cachedPage?.posts || []);
  const [profilesById, setProfilesById] = useState(() => cachedPage?.profilesById || {});
  const [loading, setLoading] = useState(() => !cachedPage);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!slug) return;

    async function loadModulePage() {
      setErrorMessage('');

      const cached = getCachedModulePage(slug);
      if (cached) {
        setModule(cached.module);
        setPosts(cached.posts);
        setProfilesById(cached.profilesById);
        setLoading(false);
      } else {
        setLoading(true);
      }

      try {
        const pageData = await prefetchModulePage(slug, { force: true });
        setModule(pageData.module);
        setPosts(pageData.posts);
        setProfilesById(pageData.profilesById);
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

      <header style={{ alignItems: 'center', backdropFilter: 'blur(14px)', backgroundColor: 'rgba(244, 247, 250, 0.92)', borderBottom: '1px solid rgba(217, 228, 245, 0.5)', display: 'flex', justifyContent: 'space-between', padding: '18px 18px 14px', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={() => router.push('/m')} style={{ background: 'transparent', border: 'none', color: '#6B99C3', cursor: 'pointer', fontSize: '15px', fontWeight: 600, padding: 0 }}>← 小館</button>
        <div style={{ color: '#2A3F54', fontSize: '15px', fontWeight: 700 }}>{module?.name || '小館'}</div>
        <button type="button" onClick={() => router.push(`/submit?module=${slug}`)} style={{ backgroundColor: '#FFFFFF', border: '1px solid #C2D6E6', borderRadius: '999px', color: '#6B99C3', cursor: 'pointer', fontSize: '13px', fontWeight: 700, padding: '7px 10px' }}>投稿</button>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '600px', padding: '18px 0 104px' }}>
        {loading && <div style={{ color: '#87ACCA', padding: '44px 18px', textAlign: 'center' }}>正在打開小館...</div>}

        {!loading && errorMessage && <div style={{ color: '#9F5E4C', lineHeight: 1.8, padding: '32px 18px', textAlign: 'center' }}>{errorMessage}</div>}

        {!loading && module && (
          <>
            <section style={{ backgroundColor: '#FFFFFF', borderBottom: '1px solid #E8EFF5', borderTop: '1px solid #E8EFF5', padding: '18px 16px' }}>
              <h1 style={{ color: '#2A3F54', fontSize: '24px', lineHeight: 1.25, margin: 0 }}>{module.name}</h1>
              <p style={{ color: '#6B99C3', fontSize: '14px', lineHeight: 1.75, margin: '8px 0 0' }}>{module.description || '這座小館正在收納它的第一批策展。'}</p>
              <div style={{ backgroundColor: '#F4F7FA', borderLeft: '3px solid #87ACCA', color: '#52769A', fontSize: '13px', lineHeight: 1.7, marginTop: '14px', padding: '9px 11px' }}>
                館規：{module.rule_text || '這座小館的收錄規則正在整理中。'}
              </div>
            </section>

            <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', padding: '18px 16px 10px' }}>
              <h2 style={{ color: '#2A3F54', fontSize: '17px', margin: 0 }}>最新策展</h2>
              <button type="button" onClick={() => router.push(`/submit?module=${module.slug}`)} style={{ background: 'transparent', border: 'none', color: '#6B99C3', cursor: 'pointer', fontSize: '13px', fontWeight: 700, padding: 0 }}>投遞到此小館</button>
            </div>

            {posts.length === 0 && <div style={{ color: '#87ACCA', lineHeight: 1.8, padding: '38px 18px', textAlign: 'center' }}>這座小館還沒有策展。等第一束光被放進來。</div>}

            {posts.map((post) => <ModulePostCard key={post.id} post={post} profile={profilesById[post.user_id]} router={router} />)}
          </>
        )}
      </main>
      <AppBottomNav active="modules" />
    </div>
  );
}
