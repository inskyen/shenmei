import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PageShell from '@/components/PageShell';
import { supabase } from '@/lib/supabase/client';

const fieldStyle = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1px solid rgba(135, 172, 202, 0.55)',
  borderRadius: '12px',
  color: '#2A527A',
  fontSize: '15px',
  lineHeight: 1.5,
  outline: 'none',
  padding: '12px 14px',
};

const labelStyle = {
  color: '#2A527A',
  display: 'block',
  fontSize: '14px',
  fontWeight: 600,
  marginBottom: '8px',
};

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
  const [sourceInput, setSourceInput] = useState('');
  const [videoTitle, setVideoTitle] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [note, setNote] = useState('');
  const [modules, setModules] = useState([]);
  const [selectedModuleIds, setSelectedModuleIds] = useState([]);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

    if (error) {
      throw error;
    }

    return data;
  };

  const ensureProfile = async (user) => {
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    if (existingProfile) {
      return;
    }

    const emailName = user.email?.split('@')[0] || '策展人';

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          username: createFallbackUsername(),
          display_name: emailName,
        });

      if (!insertError) {
        return;
      }

      if (insertError.code !== '23505') {
        throw insertError;
      }
    }

    throw new Error('使用者名稱生成失敗，請再試一次。');
  };

  const createVideo = async (bvid) => {
    const title = videoTitle.trim();

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

    if (error) {
      throw error;
    }

    return data;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    const bvid = parseBvid(sourceInput);
    const trimmedNote = note.trim();

    if (!bvid) {
      setMessage('請貼上 B 站連結，或輸入正確的 BVID。');
      return;
    }

    if (trimmedNote.length < 10) {
      setMessage('推薦理由至少需要 10 個字，讓這次策展有一點你的溫度。');
      return;
    }

    setSubmitting(true);

    try {
      const { data: userResult, error: userError } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!userResult?.user) {
        router.push('/login');
        return;
      }

      await ensureProfile(userResult.user);

      let video = await findExistingVideo(bvid);

      if (!video) {
        video = await createVideo(bvid);
      }

      const { data: post, error: postError } = await supabase
        .from('posts')
        .insert({
          user_id: userResult.user.id,
          video_id: video.id,
          note: trimmedNote,
          visibility: 'public',
          status: 'published',
        })
        .select('id')
        .single();

      if (postError) {
        throw postError;
      }

      if (selectedModuleIds.length > 0) {
        const rows = selectedModuleIds.map((moduleId) => ({
          post_id: post.id,
          module_id: moduleId,
          added_by: userResult.user.id,
        }));

        const { error: moduleError } = await supabase
          .from('post_modules')
          .insert(rows);

        if (moduleError) {
          throw moduleError;
        }
      }

      router.push('/');
    } catch (error) {
      console.error('發布策展失敗:', error);
      setMessage(error.message || '發布失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      title="發佈策展"
      subtitle="把一支影片放進大廳，並留下你為什麼想推薦它。"
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '18px' }}>
        <div>
          <label htmlFor="source" style={labelStyle}>B 站連結 / BVID</label>
          <input
            id="source"
            value={sourceInput}
            onChange={(event) => setSourceInput(event.target.value)}
            placeholder="https://www.bilibili.com/video/BV..."
            style={fieldStyle}
          />
        </div>

        <div>
          <label htmlFor="note" style={labelStyle}>推薦理由</label>
          <textarea
            id="note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="寫下你想把它放進審美者的理由。"
            rows={5}
            style={{ ...fieldStyle, resize: 'vertical' }}
          />
          <div style={{ color: '#87ACCA', fontSize: '12px', marginTop: '6px' }}>
            {note.trim().length}/10
          </div>
        </div>

        <div style={{ borderTop: '1px solid rgba(194, 214, 230, 0.6)', paddingTop: '18px' }}>
          <div style={{ color: '#87ACCA', fontSize: '13px', lineHeight: 1.7, marginBottom: '12px' }}>
            如果這支影片還沒被收錄，下面至少需要填影片標題。已收錄影片可以不填。
          </div>

          <label htmlFor="videoTitle" style={labelStyle}>影片標題</label>
          <input
            id="videoTitle"
            value={videoTitle}
            onChange={(event) => setVideoTitle(event.target.value)}
            placeholder="新影片第一次收錄時需要"
            style={fieldStyle}
          />
        </div>

        <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <div>
            <label htmlFor="authorName" style={labelStyle}>UP 主</label>
            <input
              id="authorName"
              value={authorName}
              onChange={(event) => setAuthorName(event.target.value)}
              placeholder="選填"
              style={fieldStyle}
            />
          </div>

          <div>
            <label htmlFor="coverUrl" style={labelStyle}>封面 URL</label>
            <input
              id="coverUrl"
              value={coverUrl}
              onChange={(event) => setCoverUrl(event.target.value)}
              placeholder="選填"
              style={fieldStyle}
            />
          </div>
        </div>

        {modules.length > 0 && (
          <div>
            <div style={labelStyle}>小館</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {modules.map((module) => {
                const selected = selectedModuleIds.includes(module.id);

                return (
                  <button
                    key={module.id}
                    type="button"
                    onClick={() => toggleModule(module.id)}
                    style={{
                      backgroundColor: selected ? '#6B99C3' : '#FFFFFF',
                      border: '1px solid #6B99C3',
                      borderRadius: '999px',
                      color: selected ? '#FFFFFF' : '#6B99C3',
                      cursor: 'pointer',
                      padding: '8px 12px',
                    }}
                  >
                    {module.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {message && (
          <div style={{
            backgroundColor: '#FFF7F4',
            border: '1px solid #F4D8CD',
            borderRadius: '12px',
            color: '#9F5E4C',
            fontSize: '14px',
            lineHeight: 1.6,
            padding: '12px 14px',
          }}>
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            backgroundColor: submitting ? '#C2D6E6' : '#2A527A',
            border: 'none',
            borderRadius: '14px',
            color: '#FFFFFF',
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 700,
            padding: '13px 16px',
          }}
        >
          {submitting ? '發佈中...' : '發佈到大廳'}
        </button>
      </form>
    </PageShell>
  );
}
