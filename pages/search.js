import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import { requireLogin } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';

const pageStyle = {
  backgroundColor: 'var(--bg-base)',
  color: 'var(--text-primary)',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  minHeight: '100vh',
};

const cardStyle = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-light)',
  borderRadius: '8px',
};

const inputStyle = {
  backgroundColor: 'var(--bg-base)',
  border: '1px solid var(--border-light)',
  borderRadius: '6px',
  boxSizing: 'border-box',
  color: 'var(--text-primary)',
  fontSize: '15px',
  outline: 'none',
  padding: '13px 14px',
  width: '100%',
  transition: 'all 0.2s',
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

  const goToSubmit = async (path) => {
    try {
      const user = await requireLogin({
        router,
        nextPath: path,
        message: '請先登入，才能發佈策展。',
      });

      if (user) {
        router.push(path);
      }
    } catch (error) {
      console.error('登入狀態檢查失敗:', error);
      setMessage('登入狀態確認失敗，請稍後再試。');
    }
  };

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
        <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>探索</div>
        <button
          type="button"
          onClick={() => goToSubmit('/submit')}
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
          發佈
        </button>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '760px', padding: '22px 16px 104px' }}>
        <section style={{ marginBottom: '18px' }}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, lineHeight: 1.25, margin: 0 }}>
            探索影片
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, margin: '6px 0 0' }}>
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
              backgroundColor: loading ? 'var(--border-light)' : 'var(--brand-blue)',
              border: 'none',
              borderRadius: '6px',
              color: loading ? 'var(--text-tertiary)' : '#FFFFFF',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 500,
              padding: '12px 14px',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '搜尋中...' : '搜尋'}
          </button>
        </form>

        {message && (
          <section style={{
            ...cardStyle,
            color: '#FF4D4F',
            fontSize: '13px',
            fontWeight: '500',
            lineHeight: 1.8,
            marginTop: '14px',
            padding: '16px',
            textAlign: 'center',
          }}>
            {message}
          </section>
        )}

        {!loading && searched && results.length === 0 && !message && (
          <section style={{ ...cardStyle, color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.8, marginTop: '14px', padding: '24px 18px', textAlign: 'center' }}>
            站內還沒有收錄這支影片。
            <div style={{ marginTop: '14px' }}>
              <button
                type="button"
                onClick={() => goToSubmit('/submit')}
                style={{
                  backgroundColor: 'var(--brand-blue)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#FFFFFF',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  padding: '11px 20px',
                  transition: 'all 0.2s',
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
                    backgroundColor: 'var(--bg-base)',
                    backgroundImage: video.cover ? `url(${video.cover})` : 'none',
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    borderRadius: '4px',
                    minHeight: '76px',
                    border: '1px solid var(--border-light)'
                  }} />

                  <div style={{ minWidth: 0 }}>
                    <div style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, lineHeight: 1.45 }}>
                      {video.title || '未命名影片'}
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.7, marginTop: '6px' }}>
                      {video.author} · {video.bvid || '無 BVID'}
                    </div>
                  </div>
                </button>

                <div style={{
                  borderTop: '1px solid var(--border-light)',
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                }}>
                  <button
                    type="button"
                    onClick={() => router.push(`/v/${video.id}`)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
                      padding: '12px',
                    }}
                  >
                    看影片頁
                  </button>
                  <button
                    type="button"
                    onClick={() => goToSubmit(buildSubmitHref({ external_id: video.bvid, title: video.title }))}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderLeft: '1px solid var(--border-light)',
                      color: 'var(--brand-blue)',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: 500,
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
      <AppBottomNav active="search" />
    </div>
  );
}
