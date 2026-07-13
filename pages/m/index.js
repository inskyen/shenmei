import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import { loadProfileRole, USER_ROLES } from '@/lib/auth/roles';
import { getCachedModules, prefetchModulePage, prefetchModules } from '@/lib/cache/modulePageCache';
import { supabase } from '@/lib/supabase/client';
import { showToast } from '@/lib/ui/toast';

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
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingModule, setCreatingModule] = useState(false);
  const [moduleName, setModuleName] = useState('');
  const [moduleDescription, setModuleDescription] = useState('');
  const [moduleRuleText, setModuleRuleText] = useState('');

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

  useEffect(() => {
    let isActive = true;

    async function loadAdminState() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const role = await loadProfileRole(session?.user?.id);
        if (isActive) setIsSuperAdmin(role === USER_ROLES.SUPER_ADMIN);
      } catch (error) {
        console.warn('讀取小館管理權限失敗:', error);
      }
    }

    loadAdminState();
    return () => { isActive = false; };
  }, []);

  const openModule = (module) => {
    router.prefetch(`/m/${module.slug}`);
    prefetchModulePage(module.slug).catch((error) => console.error('小館預取失敗:', error));
    router.push(`/m/${module.slug}`);
  };

  const createModule = async (event) => {
    event.preventDefault();
    const name = moduleName.trim();

    if (!name) {
      showToast('請先填寫小館名稱。');
      return;
    }

    setCreatingModule(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('請先登入超管帳號。');

      const generatedSlug = `module-${Date.now().toString(36)}`;
      const { error } = await supabase
        .from('modules')
        .insert({
          name,
          slug: generatedSlug,
          description: moduleDescription.trim() || null,
          rule_text: moduleRuleText.trim(),
          owner_id: session.user.id,
          status: 'active',
        });

      if (error) throw error;

      const nextModules = await prefetchModules({ force: true });
      setModules(nextModules);
      setModuleName('');
      setModuleDescription('');
      setModuleRuleText('');
      setShowCreateForm(false);
      showToast('小館已建立。', 'success');
    } catch (error) {
      console.error('建立小館失敗:', error);
      showToast(error.message || '建立小館失敗，請稍後再試。');
    } finally {
      setCreatingModule(false);
    }
  };

  const archiveModule = async (module) => {
    if (!window.confirm(`確定要關閉「${module.name}」嗎？\n舊內容會保留，但之後不能再投遞。`)) return;

    try {
      const { error } = await supabase
        .from('modules')
        .update({ status: 'archived' })
        .eq('id', module.id);

      if (error) throw error;

      const nextModules = await prefetchModules({ force: true });
      setModules(nextModules);
      showToast('小館已關閉，歷史內容仍可保留瀏覽。', 'success');
    } catch (error) {
      console.error('關閉小館失敗:', error);
      showToast(error.message || '關閉小館失敗，請稍後再試。');
    }
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
          {isSuperAdmin && <button type="button" onClick={() => setShowCreateForm((visible) => !visible)} style={{ background: 'transparent', border: '1px solid var(--brand-blue)', borderRadius: '6px', color: 'var(--brand-blue)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, marginTop: '14px', padding: '7px 11px' }}>{showCreateForm ? '收起建立表單' : '+ 建立小館'}</button>}
        </section>

        {isSuperAdmin && showCreateForm && (
          <form onSubmit={createModule} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '8px', display: 'grid', gap: '12px', marginBottom: '20px', padding: '16px' }}>
            <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>建立小館</div>
            <input value={moduleName} onChange={(event) => setModuleName(event.target.value)} maxLength={40} placeholder="小館名稱，例如：2022 小館" style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', font: 'inherit', fontSize: '14px', outline: 'none', padding: '10px 11px' }} />
            <input value={moduleDescription} onChange={(event) => setModuleDescription(event.target.value)} maxLength={120} placeholder="一句小館簡介（選填）" style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', font: 'inherit', fontSize: '14px', outline: 'none', padding: '10px 11px' }} />
            <textarea value={moduleRuleText} onChange={(event) => setModuleRuleText(event.target.value)} maxLength={300} placeholder="收錄規則（選填）" rows={3} style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', font: 'inherit', fontSize: '14px', lineHeight: 1.5, outline: 'none', padding: '10px 11px', resize: 'vertical' }} />
            <button type="submit" disabled={creatingModule} style={{ backgroundColor: creatingModule ? 'var(--border-light)' : 'var(--brand-blue)', border: 'none', borderRadius: '6px', color: '#FFFFFF', cursor: creatingModule ? 'wait' : 'pointer', fontSize: '14px', fontWeight: 600, padding: '10px 14px' }}>{creatingModule ? '建立中...' : '建立小館'}</button>
          </form>
        )}

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

        {isSuperAdmin && !loading && modules.length > 0 && (
          <section style={{ borderTop: '1px solid var(--border-light)', marginTop: '28px', paddingTop: '18px' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>小館管理</h2>
            <div style={{ display: 'grid', gap: '8px' }}>
              {modules.map((module) => (
                <div key={module.id} style={{ alignItems: 'center', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '6px', display: 'flex', gap: '12px', justifyContent: 'space-between', padding: '10px 12px' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{module.name}</span>
                  <button type="button" onClick={() => archiveModule(module)} style={{ background: 'transparent', border: 'none', color: '#B85B6B', cursor: 'pointer', flex: '0 0 auto', fontSize: '12px', padding: '3px 0' }}>關閉</button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <AppBottomNav active="modules" />
    </div>
  );
}
