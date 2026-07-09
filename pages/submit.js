import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { requireLogin } from '@/lib/auth/requireLogin';
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

  const prefilledBvid = router.isReady && typeof router.query.bvid === 'string' ? router.query.bvid : '';
  const prefilledTitle = router.isReady && typeof router.query.title === 'string' ? router.query.title : '';
  const sourceValue = sourceInput ?? prefilledBvid;
  const videoTitleValue = videoTitle ?? prefilledTitle;

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
    router.replace('/submit', undefined, { shallow: true });
  };

  useEffect(() => {
    async function loadModules() {
      const { data, error } = await supabase
        .from('modules')
        .select('id, name, slug')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (!error) {
        setModules(data || []);
      }
    }

    loadModules();
  }, []);

  const toggleModule = (moduleId) => {
    setSelectedModuleIds((currentIds) => (
      currentIds.includes(moduleId)
        ? currentIds.filter((id) => id !== moduleId)
        : [...currentIds, moduleId]
    ));
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
      setMessage('請填寫推薦理由，讓這次策展有一點你的溫度。');
      return;
    }

    setSubmitting(true);

    try {
      const user = await requireLogin({
        router,
        nextPath: router.asPath,
        message: '請先登入，才能發佈策展。',
      });

      if (!user) return;
      await ensureProfile(user);

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

      if (selectedModuleIds.length > 0) {
        const rows = selectedModuleIds.map((moduleId) => ({
          post_id: post.id,
          module_id: moduleId,
          added_by: user.id,
        }));

        const { error: moduleError } = await supabase
          .from('post_modules')
          .insert(rows);

        if (moduleError) throw moduleError;
      }

      router.push('/');
    } catch (error) {
      console.error('發布策展失敗:', error);
      setMessage(error.message || '發佈失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  const hasParsedVideo = !!videoTitleValue || (sourceValue && !sourceValue.includes('http') && sourceValue.startsWith('BV'));
  const canPublish = hasParsedVideo && note.trim().length > 0 && !submitting;

  return (
    <div style={{
      backgroundColor: '#F9FAFB',
      minHeight: '100vh',
      color: '#2A527A',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Head>
        <title>發佈策展 · 審美者</title>
      </Head>

      {/* App Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '16px 20px',
        maxWidth: '680px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
         <button onClick={() => router.back()} style={{ border: 'none', background: 'none', fontSize: '26px', color: '#87ACCA', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
           ×
         </button>
         <button 
           onClick={handleSubmit} 
           disabled={!canPublish}
           style={{
             backgroundColor: canPublish ? '#6B99C3' : '#E1E9F0',
             color: canPublish ? '#FFFFFF' : '#87ACCA',
             border: 'none',
             borderRadius: '20px',
             padding: '8px 24px',
             fontSize: '15px',
             fontWeight: 600,
             cursor: canPublish ? 'pointer' : 'not-allowed',
             transition: 'all 0.2s'
           }}
         >
           {submitting ? '發佈中...' : '發佈'}
         </button>
      </header>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 20px 40px', maxWidth: '680px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
         <textarea 
           value={note}
           onChange={(e) => setNote(e.target.value)}
           placeholder="寫下你想把它放進審美者的理由..."
           style={{
             width: '100%',
             flex: 1,
             border: 'none',
             background: 'transparent',
             outline: 'none',
             fontSize: '17px',
             lineHeight: '1.6',
             color: '#2A527A',
             resize: 'none',
             minHeight: '200px',
             fontFamily: 'inherit'
           }}
         />
         <div style={{ display: 'none' }}></div>

         {/* Link Input or Rich Media Card */}
         {hasParsedVideo ? (
           <div style={{
             backgroundColor: '#FFFFFF',
             borderRadius: '16px',
             padding: '14px',
             display: 'flex',
             gap: '14px',
             boxShadow: '0 2px 12px rgba(42,82,122,0.06)',
             position: 'relative',
             alignItems: 'center'
           }}>
              <button 
                onClick={clearVideo}
                style={{ position: 'absolute', top: '-10px', right: '-10px', background: '#FFFFFF', color: '#87ACCA', border: '1px solid #E1E9F0', borderRadius: '50%', width: '26px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', boxShadow: '0 2px 6px rgba(0,0,0,0.05)' }}>
                ×
              </button>
              
              <div style={{ width: '110px', height: '70px', borderRadius: '8px', overflow: 'hidden', flexShrink: 0, backgroundColor: '#E1E9F0', position: 'relative' }}>
                 {coverUrl ? (
                   <img src={coverUrl} alt="cover" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                 ) : (
                   <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#87ACCA', fontSize: '12px' }}>無封面</div>
                 )}
                 <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '28px', height: '28px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                   <svg width="12" height="12" viewBox="0 0 24 24" fill="white"><path d="M5 3l14 9-14 9V3z"/></svg>
                 </div>
              </div>

              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                 <div style={{ fontWeight: 600, fontSize: '15px', color: '#2A527A', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                   {videoTitleValue || '未知標題影片'}
                 </div>
                 <div style={{ color: '#87ACCA', fontSize: '13px' }}>
                   {authorName ? `@ ${authorName}` : sourceValue}
                 </div>
              </div>
           </div>
         ) : (
           <div style={{ 
             border: '1px dashed #87ACCA', 
             borderRadius: '99px', 
             padding: '8px 8px 8px 16px', 
             display: 'flex', 
             alignItems: 'center',
             backgroundColor: 'rgba(255,255,255,0.4)',
             transition: 'all 0.2s'
           }}>
              <span style={{ marginRight: '8px', color: '#87ACCA' }}>🔗</span>
              <input 
                value={sourceValue}
                onChange={handleSourceChange}
                placeholder="貼上 B 站連結或 BV 號..."
                style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', color: '#2A527A', fontSize: '15px' }}
              />
              <button
                type="button"
                onClick={handleParse}
                disabled={isParsing || !sourceValue}
                style={{
                  backgroundColor: (isParsing || !sourceValue) ? '#E1E9F0' : '#87ACCA',
                  color: 'white',
                  border: 'none',
                  borderRadius: '99px',
                  padding: '8px 18px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: (isParsing || !sourceValue) ? 'not-allowed' : 'pointer'
                }}
              >
                 {isParsing ? '解析中' : '解析'}
              </button>
           </div>
         )}

         {message && (
            <div style={{ marginTop: '16px', color: '#9F5E4C', fontSize: '13px', backgroundColor: '#FFF7F4', padding: '10px 14px', borderRadius: '12px', border: '1px solid #F4D8CD' }}>
              {message}
            </div>
         )}

         {/* Tags / Rooms */}
         {modules.length > 0 && (
           <div style={{ marginTop: '32px' }}>
             <div style={{ fontSize: '14px', fontWeight: 600, color: '#2A527A', marginBottom: '12px' }}>
               你想把它放進哪個展間？<span style={{ fontWeight: 'normal', color: '#87ACCA', fontSize: '13px' }}>（選填）</span>
             </div>
             <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
               {modules.map(m => {
                 const isSelected = selectedModuleIds.includes(m.id);
                 return (
                   <button
                     key={m.id}
                     type="button"
                     onClick={() => toggleModule(m.id)}
                     style={{
                       backgroundColor: isSelected ? '#6B99C3' : '#FFFFFF',
                       color: isSelected ? '#FFFFFF' : '#6B99C3',
                       border: isSelected ? '1px solid #6B99C3' : '1px solid rgba(135, 172, 202, 0.4)',
                       borderRadius: '99px',
                       padding: '8px 16px',
                       fontSize: '14px',
                       cursor: 'pointer',
                       transition: 'all 0.2s'
                     }}
                   >
                     # {m.name}
                   </button>
                 );
               })}
             </div>
           </div>
         )}
      </main>
    </div>
  );
}
