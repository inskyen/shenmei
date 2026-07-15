import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import AestheteBadge from '@/components/AestheteBadge';
import ImmersiveVideoPlayer from '@/components/ImmersiveVideoPlayer';
import { requireLogin } from '@/lib/auth/requireLogin';
import { canCurateInModules, loadProfileRole } from '@/lib/auth/roles';
import { getCachedModulePage, prefetchModulePage } from '@/lib/cache/modulePageCache';
import { showToast } from '@/lib/ui/toast';

const pageStyle = {
  backgroundColor: 'var(--bg-base)',
  color: 'var(--text-primary)',
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

function ModulePostCard({ post, profile, router, onPlay }) {
  const video = post.videos || {};
  const displayName = getDisplayName(post, profile);

  return (
    <article style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)', padding: '16px 0' }}>
      <button
        type="button"
        onClick={() => router.push(`/p/${post.id}`)}
        style={{ alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', marginBottom: '12px', padding: '0 16px', textAlign: 'left', width: '100%' }}
      >
        <span style={{ alignItems: 'center', display: 'flex', gap: '8px', minWidth: 0 }}>
          <span
            style={{ alignItems: 'center', backgroundColor: 'var(--bg-base)', backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', border: '1px solid var(--border-light)', borderRadius: '50%', color: 'var(--text-secondary)', display: 'flex', flex: '0 0 auto', fontSize: '12px', fontWeight: 500, height: '28px', justifyContent: 'center', overflow: 'hidden', width: '28px' }}
          >
            {!profile?.avatar_url && getInitial(displayName)}
          </span>
          <span style={{ alignItems: 'center', display: 'flex', gap: '6px', minWidth: 0 }}>
            <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
            <AestheteBadge role={profile?.role} />
            <span style={{ color: 'var(--text-tertiary)', flex: '0 0 auto', fontSize: '11px' }}>· {formatDate(post.created_at)}</span>
          </span>
        </span>
        <span style={{ color: 'var(--text-tertiary)', fontSize: '18px', lineHeight: 1 }}>⋮</span>
      </button>

      <button
        type="button"
        onClick={() => onPlay(video)}
        aria-label={`播放影片：${video.title || '未命名影片'}`}
        style={{ backgroundColor: 'var(--bg-base)', backgroundImage: video.cover_url ? `url(${video.cover_url})` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', border: '1px solid var(--border-light)', cursor: 'pointer', display: 'block', margin: '0 16px 12px', borderRadius: '8px', overflow: 'hidden', position: 'relative', width: 'calc(100% - 32px)', paddingTop: 'calc((100% - 32px) * 0.5625)' }}
      >
        <span style={{ alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.75)', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', display: 'flex', height: '42px', justifyContent: 'center', left: '50%', position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', width: '42px', backdropFilter: 'blur(4px)' }}>
          <span style={{ borderBottom: '7px solid transparent', borderLeft: '10px solid var(--text-primary)', borderTop: '7px solid transparent', height: 0, marginLeft: '3px', width: 0 }} />
        </span>
      </button>

      <button
        type="button"
        onClick={() => router.push(`/p/${post.id}`)}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'block', marginBottom: '12px', padding: '0 16px', textAlign: 'left', width: '100%' }}
      >
        <p style={{ WebkitBoxOrient: 'vertical', WebkitLineClamp: 3, color: 'var(--text-primary)', display: '-webkit-box', fontSize: '14px', letterSpacing: '0.2px', lineHeight: 1.5, margin: 0, overflow: 'hidden', wordBreak: 'break-word' }}>
          {post.note || video.title || '這支影片還在等一段推薦理由。'}
        </p>
      </button>

      <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}>
        <button
          type="button"
          onClick={() => router.push(`/v/${video.id}`)}
          style={{ alignItems: 'center', backgroundColor: 'var(--brand-blue-light)', border: 'none', borderRadius: '4px', color: 'var(--brand-blue)', cursor: 'pointer', display: 'inline-flex', fontSize: '11px', fontWeight: 500, gap: '4px', maxWidth: '60%', overflow: 'hidden', padding: '4px 8px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.title || '影片資料'}</span>
        </button>
        <button
          type="button"
          onClick={() => router.push(`/p/${post.id}`)}
          style={{ alignItems: 'center', background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', fontSize: '12px', gap: '14px', padding: 0 }}
        >
          <span>留言 {post.comment_count || 0}</span>
          <span>♡ {post.like_count || 0}</span>
        </button>
      </div>
    </article>
  );
}

function ModulePageSkeleton() {
  return (
    <>
      <section style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)', padding: '18px 16px' }}>
        <div className="app-detail-skeleton" style={{ borderRadius: '4px', height: '24px', width: '34%' }} />
        <div className="app-detail-skeleton" style={{ borderRadius: '4px', height: '14px', marginTop: '12px', width: '82%' }} />
        <div className="app-detail-skeleton" style={{ borderRadius: '4px', height: '14px', marginTop: '8px', width: '58%' }} />
        <div className="app-detail-skeleton" style={{ borderRadius: '4px', height: '44px', marginTop: '16px', width: '100%' }} />
      </section>
      <div style={{ padding: '18px 16px 10px' }}>
        <div className="app-detail-skeleton" style={{ borderRadius: '4px', height: '16px', width: '86px' }} />
      </div>
      {[0, 1].map((item) => (
        <article key={item} style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)', padding: '16px' }}>
          <div style={{ alignItems: 'center', display: 'flex', gap: '8px' }}>
            <div className="app-detail-skeleton" style={{ borderRadius: '50%', height: '28px', width: '28px' }} />
            <div className="app-detail-skeleton" style={{ borderRadius: '4px', height: '13px', width: item === 0 ? '110px' : '86px' }} />
          </div>
          <div className="app-detail-skeleton" style={{ borderRadius: '8px', height: '205px', marginTop: '14px' }} />
          <div className="app-detail-skeleton" style={{ borderRadius: '4px', height: '14px', marginTop: '14px', width: '74%' }} />
        </article>
      ))}
    </>
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
  const [immersiveVideo, setImmersiveVideo] = useState(null);

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
        const pageData = await prefetchModulePage(slug);
        setModule(pageData.module);
        setPosts(pageData.posts);
        setProfilesById(pageData.profilesById);
      } catch (error) {
        console.error('頻道詳情載入失敗:', error);
        setErrorMessage('這個頻道暫時無法顯示，可能尚未開放或已被移除。');
      } finally {
        setLoading(false);
      }
    }

    loadModulePage();
  }, [slug]);

  useEffect(() => {
    const closePlayerOnBack = () => setImmersiveVideo(null);
    window.addEventListener('popstate', closePlayerOnBack);
    return () => window.removeEventListener('popstate', closePlayerOnBack);
  }, []);

  const openImmersiveVideo = (video) => {
    window.history.pushState({ immersiveVideo: true }, '');
    setImmersiveVideo(video);
  };

  const closeImmersiveVideo = () => {
    setImmersiveVideo(null);
    if (window.history.state?.immersiveVideo) window.history.back();
  };

  const goToModuleSubmit = async () => {
    if (module?.status === 'archived') {
      showToast('這個頻道已關閉，現在只保留歷史內容。');
      return;
    }

    const user = await requireLogin({
      router,
      nextPath: `/m/${slug}`,
      message: '請先登入，才能投稿至頻道。',
    });

    if (!user) return;

    try {
      const role = await loadProfileRole(user.id);
      if (!canCurateInModules(role)) {
        showToast('成為審美者後，即可投稿至頻道。');
        return;
      }

      router.push(`/submit?module=${slug}`);
    } catch (error) {
      console.error('讀取頻道投稿權限失敗:', error);
      showToast('目前無法確認投遞權限，請稍後再試。');
    }
  };

  return (
    <div style={pageStyle}>
      <Head>
        <title>{module ? `${module.name} · 審美者` : '頻道 · 審美者'}</title>
      </Head>

      <header style={{ alignItems: 'center', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', padding: '48px 18px 14px', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={() => router.push('/m')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', fontWeight: 500, padding: 0 }}>← 頻道</button>
        <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>{module?.name || '頻道'}</div>
        {module?.status !== 'archived' && <button type="button" onClick={goToModuleSubmit} style={{ backgroundColor: 'var(--brand-blue)', border: 'none', borderRadius: '6px', color: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: 500, padding: '6px 14px' }}>投遞</button>}
      </header>

      <main style={{ margin: '0 auto', maxWidth: '600px', padding: '18px 0 104px' }}>
        {loading && <ModulePageSkeleton />}

        {!loading && errorMessage && <div style={{ color: '#FF4D4F', lineHeight: 1.8, padding: '32px 18px', textAlign: 'center' }}>{errorMessage}</div>}

        {!loading && module && (
          <>
            <section style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)', padding: '18px 16px' }}>
              <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, lineHeight: 1.25, margin: 0 }}>{module.name}</h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.75, margin: '8px 0 0' }}>{module.description || '這個頻道正在收納它的第一批策展。'}</p>
              <div style={{ backgroundColor: 'var(--bg-base)', borderLeft: '3px solid var(--brand-blue)', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, marginTop: '14px', padding: '9px 11px', borderRadius: '4px' }}>
                頻道規則：{module.rule_text || '這個頻道的收錄規則正在整理中。'}
              </div>
              {module.status === 'archived' && <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '10px' }}>這個頻道已關閉，僅保留歷史內容。</div>}
            </section>

            <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', padding: '18px 16px 10px' }}>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, margin: 0 }}>最新策展</h2>
              {module.status !== 'archived' && <button type="button" onClick={goToModuleSubmit} style={{ background: 'transparent', border: 'none', color: 'var(--brand-blue)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, padding: 0 }}>投稿至此頻道</button>}
            </div>

            {posts.length === 0 && <div style={{ color: 'var(--text-tertiary)', lineHeight: 1.8, padding: '38px 18px', textAlign: 'center' }}>這個頻道還沒有策展。等第一束光被放進來。</div>}

            {posts.map((post) => <ModulePostCard key={post.id} post={post} profile={profilesById[post.user_id]} router={router} onPlay={openImmersiveVideo} />)}
          </>
        )}
      </main>
      <AppBottomNav active="modules" />
      <ImmersiveVideoPlayer video={immersiveVideo} onClose={closeImmersiveVideo} />
    </div>
  );
}
