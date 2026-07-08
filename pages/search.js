import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase/client';

const pageStyle = {
  backgroundColor: '#F0F4F8',
  color: '#2A527A',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  minHeight: '100vh',
};

const cardStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid rgba(194, 214, 230, 0.55)',
  borderRadius: '18px',
  boxShadow: '0 1px 4px rgba(42, 82, 122, 0.06)',
};

const inputStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid rgba(135, 172, 202, 0.65)',
  borderRadius: '14px',
  boxSizing: 'border-box',
  color: '#2A527A',
  fontSize: '15px',
  outline: 'none',
  padding: '13px 14px',
  width: '100%',
};

function buildSubmitHref(video) {
  const params = new URLSearchParams();

  if (video.external_id) {
    params.set('bvid', video.external_id);
  }

  if (video.title) {
    params.set('title', video.title);
  }

  return `/submit${params.toString() ? `?${params.toString()}` : ''}`;
}

function normalizeVideo(row) {
  return {
    id: row.id,
    bvid: row.external_id || row.bvid,
    title: row.title,
    cover: row.cover_url || row.cover,
    author: row.author_name || row.up_name || '未知',
  };
}

export default function SearchPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSearch = async (event) => {
    event.preventDefault();

    const query = keyword.trim();
    setMessage('');

    if (!query) {
      setResults([]);
      setSearched(false);
      setMessage('請輸入影片標題、UP 主或 BVID。');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const pattern = `%${query}%`;
      const { data, error } = await supabase
        .from('videos')
        .select('id, bvid, external_id, title, cover, cover_url, up_name, author_name')
        .or(`title.ilike.${pattern},author_name.ilike.${pattern},up_name.ilike.${pattern},external_id.ilike.${pattern},bvid.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(24);

      if (error) {
        throw error;
      }

      setResults((data || []).map(normalizeVideo));
    } catch (error) {
      console.error('搜尋影片失敗:', error);
      setMessage('搜尋暫時失敗，請稍後再試。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <Head>
        <title>探索 · 審美者</title>
      </Head>

      <header style={{
        alignItems: 'center',
        backgroundColor: 'rgba(240, 244, 248, 0.92)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(194, 214, 230, 0.5)',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '18px 18px 14px',
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
            color: '#6B99C3',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 600,
            padding: 0,
          }}
        >
          ← 大廳
        </button>
        <div style={{ color: '#2A527A', fontSize: '15px', fontWeight: 700 }}>探索</div>
        <button
          type="button"
          onClick={() => router.push('/submit')}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #C2D6E6',
            borderRadius: '999px',
            color: '#6B99C3',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
            padding: '7px 10px',
          }}
        >
          發佈
        </button>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '760px', padding: '22px 16px 88px' }}>
        <section style={{ marginBottom: '18px' }}>
          <h1 style={{ color: '#2A527A', fontSize: '26px', lineHeight: 1.25, margin: 0 }}>
            探索影片
          </h1>
          <p style={{ color: '#87ACCA', fontSize: '14px', lineHeight: 1.8, margin: '8px 0 0' }}>
            搜尋已收錄影片，進入影片主頁，或直接把它推薦到大廳。
          </p>
        </section>

        <form onSubmit={handleSearch} style={{ ...cardStyle, display: 'grid', gap: '12px', padding: '14px' }}>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="搜尋影片標題、UP 主、BVID"
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: loading ? '#C2D6E6' : '#2A527A',
              border: 'none',
              borderRadius: '14px',
              color: '#FFFFFF',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '15px',
              fontWeight: 800,
              padding: '12px 14px',
            }}
          >
            {loading ? '搜尋中...' : '搜尋'}
          </button>
        </form>

        {message && (
          <section style={{
            ...cardStyle,
            color: '#9F5E4C',
            lineHeight: 1.8,
            marginTop: '14px',
            padding: '16px',
            textAlign: 'center',
          }}>
            {message}
          </section>
        )}

        {!loading && searched && results.length === 0 && !message && (
          <section style={{ ...cardStyle, color: '#87ACCA', lineHeight: 1.8, marginTop: '14px', padding: '24px 18px', textAlign: 'center' }}>
            站內還沒有收錄這支影片。
            <div style={{ marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => router.push('/submit')}
                style={{
                  backgroundColor: '#2A527A',
                  border: 'none',
                  borderRadius: '14px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 800,
                  padding: '11px 14px',
                }}
              >
                用 BVID 發佈
              </button>
            </div>
          </section>
        )}

        {results.length > 0 && (
          <section style={{ display: 'grid', gap: '12px', marginTop: '16px' }}>
            {results.map((video) => (
              <article key={video.id} style={{ ...cardStyle, overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => router.push(`/v/${video.id}`)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'grid',
                    gap: '12px',
                    gridTemplateColumns: '112px 1fr',
                    padding: '12px',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <div style={{
                    backgroundColor: '#C2D6E6',
                    backgroundImage: video.cover ? `url(${video.cover})` : 'none',
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    borderRadius: '14px',
                    minHeight: '76px',
                  }} />

                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: '#2A527A', fontSize: '15px', fontWeight: 800, lineHeight: 1.45 }}>
                      {video.title || '未命名影片'}
                    </div>
                    <div style={{ color: '#87ACCA', fontSize: '12px', lineHeight: 1.7, marginTop: '6px' }}>
                      {video.author} · {video.bvid || '無 BVID'}
                    </div>
                  </div>
                </button>

                <div style={{
                  borderTop: '1px solid rgba(194, 214, 230, 0.45)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                }}>
                  <button
                    type="button"
                    onClick={() => router.push(`/v/${video.id}`)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#6B99C3',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 800,
                      padding: '12px',
                    }}
                  >
                    看影片頁
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(buildSubmitHref({ external_id: video.bvid, title: video.title }))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderLeft: '1px solid rgba(194, 214, 230, 0.45)',
                      color: '#2A527A',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 800,
                      padding: '12px',
                    }}
                  >
                    推薦
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
