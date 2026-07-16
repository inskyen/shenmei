import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { requireLogin } from '@/lib/auth/requireLogin';
import { canCurateInModules, loadProfileRole, USER_ROLES } from '@/lib/auth/roles';
import { prefetchModulePage } from '@/lib/cache/modulePageCache';
import { supabase } from '@/lib/supabase/client';

function parseBvid(input) {
  const text = input.trim();
  const match = text.match(/BV[0-9A-Za-z]{10}/);
  return match ? match[0] : null;
}

function buildBilibiliUrl(bvid) {
  return `https://www.bilibili.com/video/${bvid}`;
}

function createFallbackUsername() {
  return Math.floor(10000000 + Math.random() * 90000000).toString();
}

export default function SubmitPage() {
  const router = useRouter();
  const [sourceInput, setSourceInput] = useState(null);
  const [videoTitle, setVideoTitle] = useState(null);
  const [coverUrl, setCoverUrl] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [note, setNote] = useState('');
  const [modules, setModules] = useState([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [modulesLoading, setModulesLoading] = useState(true);
  const [currentRole, setCurrentRole] = useState(USER_ROLES.MEMBER);
  const [roleLoading, setRoleLoading] = useState(true);
  const [publishComplete, setPublishComplete] = useState(false);

  const prefilledBvid = router.isReady && typeof router.query.bvid === 'string' ? router.query.bvid : '';
  const prefilledTitle = router.isReady && typeof router.query.title === 'string' ? router.query.title : '';
  const forcedModuleSlug = router.isReady && typeof router.query.module === 'string' ? router.query.module : '';
  const sourceValue = sourceInput ?? prefilledBvid;
  const videoTitleValue = videoTitle ?? prefilledTitle;
  const forcedModule = modules.find((module) => module.slug === forcedModuleSlug) || null;
  const effectiveSelectedModuleIds = forcedModule ? [forcedModule.id] : selectedModuleIds;
  const canChooseModule = canCurateInModules(currentRole);

  const handleSourceChange = (event) => {
    setSourceInput(event.target.value);
  };

  const handleParse = async () => {
    if (!sourceValue) return;

    let bvid = null;
    let shortUrl = null;
    
    const bvidMatch = sourceValue.match(/BV[0-9A-Za-z]{10}/);
    const shortUrlMatch = sourceValue.match(/https?:\/\/b23\.tv\/[a-zA-Z0-9]+/);

    if (bvidMatch && bvidMatch[0]) {
      bvid = bvidMatch[0];
      setSourceInput(bvid); 
    } else if (shortUrlMatch && shortUrlMatch[0]) {
      shortUrl = shortUrlMatch[0];
      setSourceInput(shortUrl);
    } else {
      setMessage('無法從輸入內容中找到正確的 BVID 或 b23.tv 短鏈，請檢查連結。');
      return;
    }

    setIsParsing(true);
    setMessage('');
    try {
      const query = bvid ? `bvid=${bvid}` : `shortUrl=${encodeURIComponent(shortUrl)}`;
      const res = await fetch(`/api/bilibili?${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data.bvid) setSourceInput(data.bvid);
        if (data.title && !videoTitleValue) setVideoTitle(data.title);
        if (data.cover && !coverUrl) setCoverUrl(data.cover);
        if (data.author && !authorName) setAuthorName(data.author);
      } else {
        setMessage('解析失敗，請手動確保連結正確。');
      }
    } catch (err) {
      console.error('Failed to parse bilibili info:', err);
      setMessage('解析失敗，請稍後再試。');
    } finally {
      setIsParsing(false);
    }
  };

  const clearVideo = () => {
    setSourceInput('');
    setVideoTitle(null);
    setCoverUrl('');
    setAuthorName('');
    router.replace(forcedModuleSlug ? `/submit?module=${forcedModuleSlug}` : '/submit', undefined, { shallow: true });
  };

  useEffect(() => {
    async function loadModules() {
      try {
        const { data, error } = await supabase
          .from('modules')
          .select('id, name, slug, sort_order')
          .eq('status', 'active')
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: false });

        if (error) throw error;
        setModules(data || []);
      } catch (error) {
        console.error('頻道選項載入失敗:', error);
      } finally {
        setModulesLoading(false);
      }
    }

    loadModules();
  }, []);

  useEffect(() => {
    let isActive = true;

    async function loadCurrentRole() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const role = await loadProfileRole(session?.user?.id);
        if (isActive) setCurrentRole(role);
      } catch (error) {
        console.warn('讀取採樣權限失敗，暫以普通使用者處理:', error);
      } finally {
        if (isActive) setRoleLoading(false);
      }
    }

    loadCurrentRole();
    return () => { isActive = false; };
  }, []);

  const toggleModule = (moduleId) => {
    setSelectedModuleIds((currentIds) => (currentIds.includes(moduleId) ? [] : [moduleId]));
  };

  const findExistingVideo = async (bvid) => {
    const { data, error } = await supabase
      .from('videos')
      .select('id')
      .eq('source_platform', 'bilibili')
      .eq('external_id', bvid)
      .maybeSingle();

    if (error) throw error;
    return data;
  };

  const ensureProfile = async (user) => {
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (existingProfile) return;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: createFallbackUsername(),
        });

      if (!insertError) return;
      if (insertError.code !== '23505') throw insertError;
    }
    throw new Error('使用者名稱生成失敗，請再試一次。');
  };

  const createVideo = async (bvid) => {
    const title = videoTitleValue.trim();
    if (title.length < 2) {
      throw new Error('這支影片還沒有收錄，請先補上影片標題。');
    }

    const { data, error } = await supabase
      .from('videos')
      .insert({
        bvid,
        source_platform: 'bilibili',
        external_id: bvid,
        source_url: buildBilibiliUrl(bvid),
        title,
        cover: coverUrl.trim() || null,
        cover_url: coverUrl.trim() || null,
        up_name: authorName.trim() || null,
        author_name: authorName.trim() || null,
        status: 'published',
      })
      .select('id')
      .single();

    if (error) throw error;
    return data;
  };

  const handleSubmit = async (event) => {
    if (event) event.preventDefault();
    setMessage('');

    const bvid = parseBvid(sourceValue);
    const trimmedNote = note.trim();

    if (!bvid) {
      setMessage('請貼上 B 站連結，或輸入正確的 BVID。');
      return;
    }

    if (trimmedNote.length === 0) {
      setMessage('請填寫推薦理由，讓這次採樣有一點您的溫度。');
      return;
    }

    if (forcedModuleSlug && !forcedModule) {
      setMessage('這個頻道目前無法投稿，請回到頻道頁後再試。');
      return;
    }

    setSubmitting(true);

    try {
      const user = await requireLogin({
        router,
        nextPath: router.asPath,
        message: '請先登入，才能採樣。',
      });

      if (!user) return;
      await ensureProfile(user);

      const latestRole = await loadProfileRole(user.id);
      setCurrentRole(latestRole);

      if (effectiveSelectedModuleIds.length > 0 && !canCurateInModules(latestRole)) {
        setMessage('只有審美者可以投稿至頻道；這次採樣可發佈到大廳。');
        return;
      }

      let video = await findExistingVideo(bvid);
      if (!video) {
        video = await createVideo(bvid);
      }

      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          video_id: video.id,
          note: trimmedNote,
          visibility: 'public',
          status: 'published',
        })
        .select('id')
        .single();

      if (postError) throw postError;

      if (effectiveSelectedModuleIds.length > 0) {
        const rows = effectiveSelectedModuleIds.map((moduleId) => ({
          post_id: post.id,
          module_id: moduleId,
          added_by: user.id,
        }));

        const { error: moduleError } = await supabase
          .from('post_modules')
          .insert(rows);

        if (moduleError) throw moduleError;
      }

      if (forcedModule) {
        await prefetchModulePage(forcedModule.slug, { force: true })
          .catch((error) => console.error('頻道快取更新失敗:', error));
      }

      setPublishComplete(true);
      window.setTimeout(() => {
        router.push(forcedModule ? `/m/${forcedModule.slug}` : '/');
      }, 520);
    } catch (error) {
      console.error('採樣失敗:', error);
      setMessage(error.message || '採樣失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  const hasParsedVideo = !!videoTitleValue || (sourceValue && !sourceValue.includes('http') && sourceValue.startsWith('BV'));
  const canPublish = hasParsedVideo && note.trim().length > 0 && !submitting;

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
  };

  return (
    <div className="app-detail-page" style={{
      backgroundColor: 'var(--bg-base)',
      minHeight: '100vh',
      color: 'var(--text-primary)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Head>
        <title>採樣 · 審美者</title>
      </Head>

      {/* App Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '48px 20px 16px',
        maxWidth: '680px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
         <button onClick={goBack} style={{ border: 'none', background: 'none', fontSize: '26px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            ×
         </button>
         <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>採樣</div>
         <button 
           onClick={handleSubmit} 
           disabled={!canPublish}
           style={{
             backgroundColor: canPublish ? 'var(--brand-blue)' : 'var(--border-light)',
             color: canPublish ? '#FFFFFF' : 'var(--text-tertiary)',
             border: 'none',
             borderRadius: '6px',
             padding: '6px 20px',
             fontSize: '14px',
             fontWeight: 500,
             cursor: canPublish ? 'pointer' : 'not-allowed',
             transition: 'all 0.2s'
           }}
         >
           {submitting ? '採樣中...' : '採樣'}
         </button>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 20px 40px', maxWidth: '680px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
         <textarea 
           value={note}
           onChange={(e) => setNote(e.target.value)}
           placeholder="寫下您想把它採樣回來的留言..."
           style={{
             width: '100%',
             height: '180px',
             border: 'none',
             background: 'transparent',
             outline: 'none',
             fontSize: '16px',
             lineHeight: '1.6',
             color: 'var(--text-primary)',
             resize: 'none',
             fontFamily: 'inherit',
             marginBottom: '24px'
           }}
         />
         <div style={{ display: 'none' }}></div>

         {/* Link Input or Rich Media Card */}
         {hasParsedVideo ? (
           <div style={{
             backgroundColor: 'var(--bg-surface)',
             borderRadius: '8px',
             padding: '14px',
             display: 'flex',
             gap: '14px',
             position: 'relative',
             alignItems: 'center',
             border: '1px solid var(--border-light)'
           }}>
              <button 
                onClick={clearVideo}
                style={{ position: 'absolute', top: '-10px', right: '-10px', background: 'var(--bg-surface)', color: 'var(--text-tertiary)', border: '1px solid var(--border-light)', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                ×
              </button>
              
              <div style={{ width: '110px', height: '70px', borderRadius: '4px', overflow: 'hidden', flexShrink: 0, backgroundColor: 'var(--bg-base)', position: 'relative' }}>
                 {coverUrl ? (
                   <img src={coverUrl} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 ) : (
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-tertiary)', fontSize: '12px' }}>無封面</div>
                 )}
                 <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '28px', height: '28px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z"/></svg>
                 </div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                 <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                   {videoTitleValue || '未知標題影片'}
                 </div>
                 <div style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                   {authorName ? `@ ${authorName}` : sourceValue}
                 </div>
              </div>
           </div>
         ) : (
           <div style={{ 
             border: '1px solid var(--border-light)', 
             borderRadius: '6px', 
             padding: '8px 8px 8px 16px', 
             display: 'flex', 
             alignItems: 'center',
             backgroundColor: 'var(--bg-surface)',
             transition: 'all 0.2s'
           }}>
              <span style={{ marginRight: '8px', color: 'var(--text-secondary)' }}>🔗</span>
              <input 
                value={sourceValue}
                onChange={handleSourceChange}
                placeholder="貼上 B 站連結或 BV 號..."
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-primary)', fontSize: '15px' }}
              />
              <button
                type="button"
                onClick={handleParse}
                disabled={isParsing || !sourceValue}
                style={{
                  backgroundColor: (isParsing || !sourceValue) ? 'var(--border-light)' : 'var(--brand-blue)',
                  color: (isParsing || !sourceValue) ? 'var(--text-tertiary)' : '#FFFFFF',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '6px 18px',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: (isParsing || !sourceValue) ? 'not-allowed' : 'pointer'
                }}
              >
                 {isParsing ? '解析中' : '解析'}
              </button>
           </div>
         )}

         {message && (
            <div style={{ 
              marginTop: '16px', 
              color: '#FF4D4F', 
              fontSize: '13px', 
              fontWeight: '500',
              backgroundColor: 'var(--bg-surface)', 
              padding: '10px 14px', 
              borderRadius: '6px', 
              border: '1px solid var(--border-light)' 
            }}>
              {message}
            </div>
         )}

         {/* Tags / Rooms */}
         {(modulesLoading || roleLoading || modules.length > 0) && (
           <div style={{ marginTop: '32px' }}>
             {roleLoading ? (
               <div className="app-detail-skeleton" style={{ borderRadius: '6px', height: '58px', width: '100%' }} />
             ) : forcedModuleSlug && !canChooseModule ? (
               <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, padding: '12px 14px' }}>
                 這個頻道開放給審美者投稿；您仍可將這次採樣發佈到大廳。
               </div>
             ) : forcedModuleSlug ? (
               <>
                 <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>本次投遞</div>
                 <div style={{ alignItems: 'center', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between', padding: '12px 14px' }}>
                   <span style={{ fontSize: '14px', fontWeight: 600 }}>{forcedModule ? forcedModule.name : '正在確認頻道...'}</span>
                   <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>已鎖定</span>
                 </div>
               </>
             ) : !canChooseModule ? (
               <div style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, padding: '12px 14px' }}>
                 本次採樣會發佈至大廳。成為審美者後，即可選擇投稿至頻道。
               </div>
             ) : (
               <>
                 <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                   您想把它放進哪個頻道？<span style={{ fontWeight: 'normal', color: 'var(--text-secondary)', fontSize: '13px' }}>（選填，最多一個）</span>
                 </div>
                 <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                   {modulesLoading && [0, 1, 2].map((index) => (
                     <div key={index} className="app-detail-skeleton" style={{ borderRadius: '4px', height: '32px', width: '74px' }} />
                   ))}
                   {!modulesLoading && modules.map(m => {
                     const isSelected = effectiveSelectedModuleIds.includes(m.id);
                     return (
                       <button
                         key={m.id}
                         type="button"
                         onClick={() => toggleModule(m.id)}
                         style={{
                           backgroundColor: isSelected ? 'var(--brand-blue-light)' : 'var(--bg-surface)',
                           color: isSelected ? 'var(--brand-blue)' : 'var(--text-secondary)',
                           border: isSelected ? '1px solid var(--brand-blue)' : '1px solid var(--border-light)',
                           borderRadius: '4px',
                           padding: '6px 14px',
                           fontSize: '13px',
                           cursor: 'pointer',
                           transition: 'all 0.2s'
                         }}
                       >
                         # {m.name}
                       </button>
                     );
                   })}
                 </div>
               </>
             )}
           </div>
         )}
      </main>

      {publishComplete && (
        <div style={{ alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', inset: 0, justifyContent: 'center', position: 'fixed', zIndex: 80 }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '8px', border: '1px solid var(--border-light)', color: 'var(--text-primary)', padding: '24px 28px', textAlign: 'center' }}>
            <div style={{ alignItems: 'center', backgroundColor: 'var(--brand-blue-light)', borderRadius: '50%', color: 'var(--brand-blue)', display: 'flex', fontSize: '22px', height: '42px', justifyContent: 'center', margin: '0 auto 12px', width: '42px' }}>✓</div>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>{forcedModule ? `已投遞至 ${forcedModule.name}` : '已放進最新大廳'}</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>{forcedModule ? '正在帶您回到這個頻道。' : '正在帶您回到剛剛發出的採樣。'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
