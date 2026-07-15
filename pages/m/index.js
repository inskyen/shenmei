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
  const [reorderingModuleId, setReorderingModuleId] = useState(null);
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
        console.error('頻道列表載入失敗:', error);
        setErrorMessage('頻道列表暫時無法顯示，請稍後再試。');
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
        console.warn('讀取頻道管理權限失敗:', error);
      }
    }

    loadAdminState();
    return () => { isActive = false; };
  }, []);

  useEffect(() => {
    if (!modules.length || typeof window === 'undefined') return undefined;

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)) return undefined;

    const warmModulePages = () => {
      if (document.visibilityState !== 'visible') return;

      // 頻道目前數量很少，預熱前八個即可覆蓋常用入口，同時避免未來頻道數增加時過度取數。
      modules.slice(0, 8).forEach((module) => {
        router.prefetch(`/m/${module.slug}`).catch(() => {});
        prefetchModulePage(module.slug).catch((error) => console.warn('頻道詳情預熱失敗:', error));
      });
    };

    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(warmModulePages, { timeout: 1400 });
      return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timeoutId = window.setTimeout(warmModulePages, 500);
    return () => window.clearTimeout(timeoutId);
  }, [modules, router]);

  const openModule = (module) => {
    router.prefetch(`/m/${module.slug}`);
    prefetchModulePage(module.slug).catch((error) => console.error('頻道預取失敗:', error));
    router.push(`/m/${module.slug}`);
  };

  const createModule = async (event) => {
    event.preventDefault();
    const name = moduleName.trim();

    if (!name) {
      showToast('請先填寫頻道名稱。');
      return;
    }

    setCreatingModule(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error('請先登入超管帳號。');

      const generatedSlug = `module-${Date.now().toString(36)}`;
      const nextSortOrder = modules.length > 0
        ? Math.max(...modules.map((module) => Number(module.sort_order) || 0)) + 100
        : 100;
      const { error } = await supabase
        .from('modules')
        .insert({
          name,
          slug: generatedSlug,
          description: moduleDescription.trim() || null,
          rule_text: moduleRuleText.trim(),
          owner_id: session.user.id,
          status: 'active',
          sort_order: nextSortOrder,
        });

      if (error) throw error;

      const nextModules = await prefetchModules({ force: true });
      setModules(nextModules);
      setModuleName('');
      setModuleDescription('');
      setModuleRuleText('');
      setShowCreateForm(false);
      showToast('頻道已建立。', 'success');
    } catch (error) {
      console.error('建立頻道失敗:', error);
      showToast(error.message || '建立頻道失敗，請稍後再試。');
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
      showToast('頻道已關閉，歷史內容仍可保留瀏覽。', 'success');
    } catch (error) {
      console.error('關閉頻道失敗:', error);
      showToast(error.message || '關閉頻道失敗，請稍後再試。');
    }
  };

  const moveModule = async (moduleIndex, direction) => {
    const targetIndex = moduleIndex + direction;
    if (targetIndex < 0 || targetIndex >= modules.length || reorderingModuleId) return;

    const currentModule = modules[moduleIndex];
    const targetModule = modules[targetIndex];
    const currentSortOrder = Number(currentModule.sort_order) || ((moduleIndex + 1) * 100);
    const targetSortOrder = Number(targetModule.sort_order) || ((targetIndex + 1) * 100);

    setReorderingModuleId(currentModule.id);

    try {
      const [currentResult, targetResult] = await Promise.all([
        supabase.from('modules').update({ sort_order: targetSortOrder }).eq('id', currentModule.id),
        supabase.from('modules').update({ sort_order: currentSortOrder }).eq('id', targetModule.id),
      ]);

      if (currentResult.error) throw currentResult.error;
      if (targetResult.error) throw targetResult.error;

      const nextModules = await prefetchModules({ force: true });
      setModules(nextModules);
      showToast('頻道順序已更新。', 'success');
    } catch (error) {
      console.error('調整頻道順序失敗:', error);
      showToast(error.message || '調整順序失敗，請稍後再試。');
    } finally {
      setReorderingModuleId(null);
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
        <title>頻道 · 審美者</title>
      </Head>

      {/* Sticky header */}
      <header style={{
        alignItems: 'center',
        backgroundColor: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-light)',
        boxSizing: 'border-box',
        display: 'flex',
        height: '88px',
        justifyContent: 'center',
        padding: '48px 18px 14px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: 600, letterSpacing: '0.5px' }}>
          頻道
        </div>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '760px', padding: '20px 14px 104px' }}>
        {/* Page header */}
        <section style={{ marginBottom: '20px' }}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, lineHeight: 1.25, margin: 0 }}>
            頻道
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, margin: '6px 0 0' }}>
            每個頻道都有自己的收錄規則；你可以自由進入，看看這裡正在留下什麼。
          </p>
          {isSuperAdmin && <button type="button" onClick={() => setShowCreateForm((visible) => !visible)} style={{ background: 'transparent', border: '1px solid var(--brand-blue)', borderRadius: '6px', color: 'var(--brand-blue)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, marginTop: '14px', padding: '7px 11px' }}>{showCreateForm ? '收起建立表單' : '+ 建立頻道'}</button>}
        </section>

        {isSuperAdmin && showCreateForm && (
          <form onSubmit={createModule} style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '8px', display: 'grid', gap: '12px', marginBottom: '20px', padding: '16px' }}>
            <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>建立頻道</div>
            <input value={moduleName} onChange={(event) => setModuleName(event.target.value)} maxLength={40} placeholder="頻道名稱，例如：2022 頻道" style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', font: 'inherit', fontSize: '14px', outline: 'none', padding: '10px 11px' }} />
            <input value={moduleDescription} onChange={(event) => setModuleDescription(event.target.value)} maxLength={120} placeholder="一句頻道簡介（選填）" style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', font: 'inherit', fontSize: '14px', outline: 'none', padding: '10px 11px' }} />
            <textarea value={moduleRuleText} onChange={(event) => setModuleRuleText(event.target.value)} maxLength={300} placeholder="收錄規則（選填）" rows={3} style={{ background: 'transparent', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', font: 'inherit', fontSize: '14px', lineHeight: 1.5, outline: 'none', padding: '10px 11px', resize: 'vertical' }} />
            <button type="submit" disabled={creatingModule} style={{ backgroundColor: creatingModule ? 'var(--border-light)' : 'var(--brand-blue)', border: 'none', borderRadius: '6px', color: '#FFFFFF', cursor: creatingModule ? 'wait' : 'pointer', fontSize: '14px', fontWeight: 600, padding: '10px 14px' }}>{creatingModule ? '建立中...' : '建立頻道'}</button>
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
            目前還沒有開放中的頻道。先讓大廳流動起來，之後再慢慢建立新頻道。
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
            <h2 style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, margin: '0 0 10px' }}>頻道管理</h2>
            <div style={{ display: 'grid', gap: '8px' }}>
              {modules.map((module, moduleIndex) => (
                <div key={module.id} style={{ alignItems: 'center', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '6px', display: 'flex', gap: '12px', justifyContent: 'space-between', padding: '10px 12px' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{module.name}</span>
                  <div style={{ alignItems: 'center', display: 'flex', flex: '0 0 auto', gap: '9px' }}>
                    <button type="button" disabled={moduleIndex === 0 || Boolean(reorderingModuleId)} onClick={() => moveModule(moduleIndex, -1)} style={{ background: 'transparent', border: 'none', color: moduleIndex === 0 ? 'var(--text-tertiary)' : 'var(--brand-blue)', cursor: moduleIndex === 0 ? 'default' : 'pointer', fontSize: '12px', padding: '3px 0' }}>上移</button>
                    <button type="button" disabled={moduleIndex === modules.length - 1 || Boolean(reorderingModuleId)} onClick={() => moveModule(moduleIndex, 1)} style={{ background: 'transparent', border: 'none', color: moduleIndex === modules.length - 1 ? 'var(--text-tertiary)' : 'var(--brand-blue)', cursor: moduleIndex === modules.length - 1 ? 'default' : 'pointer', fontSize: '12px', padding: '3px 0' }}>下移</button>
                    <button type="button" onClick={() => archiveModule(module)} style={{ background: 'transparent', border: 'none', color: '#B85B6B', cursor: 'pointer', fontSize: '12px', padding: '3px 0' }}>關閉</button>
                  </div>
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
