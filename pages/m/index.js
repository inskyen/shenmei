import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import { getCachedModules, prefetchModulePage, prefetchModules } from '@/lib/cache/modulePageCache';

// Deterministic gradient palette based on slug hash
const GRADIENT_PALETTES = [
  ['#C1693A', '#E8A87C'],   // warm amber
  ['#3A2D6B', '#7B5EA7'],   // deep indigo
  ['#1A4A3A', '#3D8B6E'],   // forest teal
  ['#2C4A6B', '#5B8DB8'],   // slate blue
  ['#6B2D3A', '#B85B6B'],   // rose
  ['#3A4A2D', '#7A8B5E'],   // olive
  ['#4A3A1A', '#8B7A3D'],   // earth brown
  ['#1A3A5C', '#3D7AB8'],   // ocean
];

function slugToGradient(slug) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) {
    hash = slug.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENT_PALETTES.length;
  return GRADIENT_PALETTES[index];
}

function getCardBackground(module) {
  // Priority 1: module's own cover image
  if (module.cover_url) {
    return { backgroundImage: `url(${module.cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  // Priority 2: latest curated video cover
  if (module.latest_cover_url) {
    return { backgroundImage: `url(${module.latest_cover_url})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  // Priority 3: theme_color gradient
  if (module.theme_color) {
    return { background: `linear-gradient(145deg, ${module.theme_color}CC, ${module.theme_color}66)` };
  }
  // Priority 4: deterministic gradient from slug
  const [from, to] = slugToGradient(module.slug || module.name);
  return { background: `linear-gradient(145deg, ${from}, ${to})` };
}

export default function ModulesPage() {
  const router = useRouter();
  const [modules, setModules] = useState(() => getCachedModules() || []);
  const [loading, setLoading] = useState(() => !getCachedModules());
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadModules() {
      setErrorMessage('');
      try {
        const data = await prefetchModules({ force: true });
        setModules(data);
      } catch (error) {
        console.error('小館列表載入失敗:', error);
        setErrorMessage('小館列表暫時無法顯示，請稍後再試。');
      } finally {
        setLoading(false);
      }
    }
    loadModules();
  }, []);

  const openModule = (module) => {
    router.prefetch(`/m/${module.slug}`);
    prefetchModulePage(module.slug).catch((error) => console.error('小館預取失敗:', error));
    router.push(`/m/${module.slug}`);
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-base)',
      color: 'var(--text-primary)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      minHeight: '100vh',
      overflowX: 'hidden',
    }}>
      <Head>
        <title>小館 · 審美者</title>
      </Head>

      {/* Sticky header */}
      <header style={{
        alignItems: 'center',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-light)',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '48px 18px 14px',
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
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 500,
            padding: 0,
          }}
        >
          ← 大廳
        </button>
        <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>小館</div>
        <button
          type="button"
          onClick={() => router.push('/submit')}
          style={{
            backgroundColor: 'var(--brand-blue)',
            border: 'none',
            borderRadius: '6px',
            color: '#FFFFFF',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
            padding: '6px 14px',
          }}
        >
          採樣
        </button>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '760px', padding: '20px 14px 104px' }}>
        {/* Page header */}
        <section style={{ marginBottom: '20px' }}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, lineHeight: 1.25, margin: 0 }}>
            小館
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, margin: '6px 0 0' }}>
            每座小館都有自己的收錄規則；你可以自由走進來，看看這裡正在留下什麼。
          </p>
        </section>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className="app-detail-skeleton"
                style={{ aspectRatio: '4 / 3', borderRadius: '8px' }}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && errorMessage && (
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            lineHeight: 1.8,
            padding: '28px 20px',
            textAlign: 'center',
          }}>
            {errorMessage}
          </div>
        )}

        {/* Empty state */}
        {!loading && !errorMessage && modules.length === 0 && (
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-light)',
            borderRadius: '8px',
            color: 'var(--text-secondary)',
            lineHeight: 1.8,
            padding: '28px 20px',
            textAlign: 'center',
          }}>
            目前還沒有開放中的小館。先讓大廳流動起來，之後再慢慢分館。
          </div>
        )}

        {/* 2-column square grid */}
        {!loading && modules.length > 0 && (
          <section style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
            {modules.map((module) => {
              const bgStyle = getCardBackground(module);
              const hasImage = !!(module.cover_url || module.latest_cover_url);

              return (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => openModule(module)}
                  onMouseEnter={() => prefetchModulePage(module.slug).catch(() => {})}
                  onTouchStart={() => prefetchModulePage(module.slug).catch(() => {})}
                  style={{
                    ...bgStyle,
                    aspectRatio: '4 / 3',
                    border: 'none',
                    borderRadius: '8px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.02)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    overflow: 'hidden',
                    padding: 0,
                    position: 'relative',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  {/* Top: count badge */}
                  <div style={{
                    alignItems: 'flex-start',
                    display: 'flex',
                    justifyContent: 'flex-end',
                    padding: '10px 10px 0 0',
                  }}>
                    {/* We don't have post_count on the module list yet, can add later */}
                  </div>

                  {/* Bottom gradient scrim + text */}
                  <div style={{
                    background: hasImage
                      ? 'linear-gradient(to top, rgba(10,20,35,0.82) 0%, rgba(10,20,35,0.3) 55%, transparent 100%)'
                      : 'linear-gradient(to top, rgba(0,0,0,0.4) 0%, transparent 60%)',
                    borderRadius: '8px',
                    bottom: 0,
                    left: 0,
                    padding: '28px 14px 14px',
                    position: 'absolute',
                    right: 0,
                    top: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                  }}>
                    <div style={{
                      color: '#FFFFFF',
                      fontSize: '15px',
                      fontWeight: 600,
                      letterSpacing: '0.2px',
                      lineHeight: 1.3,
                    }}>
                      {module.name}
                    </div>
                    {module.description && (
                      <div style={{
                        color: 'rgba(255,255,255,0.78)',
                        fontSize: '11px',
                        fontWeight: 400,
                        lineHeight: 1.5,
                        marginTop: '4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {module.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </section>
        )}
      </main>

      <AppBottomNav active="modules" />
    </div>
  );
}
