import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import AestheteBadge from '@/components/AestheteBadge';
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
  const [userResults, setUserResults] = useState([]);
  const [activeTab, setActiveTab] = useState('videos');
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const goToSubmit = async (path) => {
    try {
      const user = await requireLogin({
        router,
        nextPath: path,
        message: '請先登入，才能採樣。',
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
      setUserResults([]);
      setMessage('請輸入影片、UP 主、BVID 或審美號。');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const pattern = `%${query}%`;
      const videoRequest = supabase
        .from('videos')
        .select('id, bvid, external_id, title, cover, cover_url, up_name, author_name')
        .or(`title.ilike.${pattern},author_name.ilike.${pattern},up_name.ilike.${pattern},external_id.ilike.${pattern},bvid.ilike.${pattern}`)
        .order('created_at', { ascending: false })
        .limit(24);

      const userRequest = supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio, role')
        .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
        .order('updated_at', { ascending: false })
        .limit(24);

      const [videoResult, profileResult] = await Promise.all([videoRequest, userRequest]);

      if (videoResult.error) throw videoResult.error;
      if (profileResult.error) throw profileResult.error;

      setResults((videoResult.data || []).map(normalizeVideo));
      setUserResults(profileResult.data || []);
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
          探索
        </div>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '760px', padding: '22px 16px 104px' }}>
        <section style={{ marginBottom: '18px' }}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: 600, lineHeight: 1.25, margin: 0 }}>
            探索
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, margin: '6px 0 0' }}>
            搜尋已收錄影片，或用審美號找到一位策展人。
          </p>
        </section>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: '24px', marginTop: '24px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', height: '18px', width: '18px', color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" /></svg>
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜尋影片、UP 主、BVID 或審美號"
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-light)',
                borderRadius: '99px',
                boxSizing: 'border-box',
                color: 'var(--text-primary)',
                fontSize: '15px',
                outline: 'none',
                padding: '14px 16px 14px 42px',
                width: '100%',
                transition: 'border-color 0.2s',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--text-secondary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-light)'}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              backgroundColor: 'var(--text-primary)',
              border: 'none',
              borderRadius: '99px',
              color: 'var(--bg-surface)',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '15px',
              fontWeight: 600,
              padding: '0 24px',
              opacity: loading ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {loading ? '...' : '搜尋'}
          </button>
        </form>

        {searched && !loading && (
          <div style={{ borderBottom: '1px solid var(--border-light)', display: 'flex', marginBottom: '24px', gap: '24px' }}>
            <button type="button" onClick={() => setActiveTab('videos')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'videos' ? '2px solid var(--text-primary)' : '2px solid transparent', color: activeTab === 'videos' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', fontWeight: activeTab === 'videos' ? 600 : 500, padding: '8px 4px', transition: 'all 0.2s' }}>
              影片 ({results.length})
            </button>
            <button type="button" onClick={() => setActiveTab('users')} style={{ background: 'none', border: 'none', borderBottom: activeTab === 'users' ? '2px solid var(--text-primary)' : '2px solid transparent', color: activeTab === 'users' ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', fontWeight: activeTab === 'users' ? 600 : 500, padding: '8px 4px', transition: 'all 0.2s' }}>
              策展人 ({userResults.length})
            </button>
          </div>
        )}

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

        {!loading && searched && activeTab === 'videos' && results.length === 0 && !message && (
          <section style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.8, marginTop: '32px', padding: '24px 0', textAlign: 'center' }}>
            站內還沒有收錄這支影片。
            <div style={{ marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => goToSubmit('/submit')}
                style={{
                  backgroundColor: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: '99px',
                  color: 'var(--bg-surface)',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 600,
                  padding: '10px 24px',
                  transition: 'opacity 0.2s',
                }}
              >
                前往採樣
              </button>
            </div>
          </section>
        )}

        {activeTab === 'videos' && results.length > 0 && (
          <section style={{ display: 'grid', gap: '20px', marginTop: '16px' }}>
            {results.map((video) => (
              <article key={video.id} style={{ display: 'flex', alignItems: 'center', paddingBottom: '20px', borderBottom: '1px solid var(--border-light)' }}>
                <div
                  onClick={() => router.push(`/v/${video.id}`)}
                  style={{ cursor: 'pointer', flex: '0 0 120px', marginRight: '16px' }}
                >
                  <div style={{
                    backgroundColor: 'var(--bg-base)',
                    backgroundImage: video.cover ? `url(${video.cover})` : 'none',
                    backgroundPosition: 'center',
                    backgroundSize: 'cover',
                    borderRadius: '8px',
                    minHeight: '68px',
                    border: '1px solid var(--border-light)'
                  }} />
                </div>
                <div style={{ flex: 1, minWidth: 0, paddingRight: '12px', cursor: 'pointer' }} onClick={() => router.push(`/v/${video.id}`)}>
                  <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, lineHeight: 1.4, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {video.title || '未命名影片'}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: 1.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {video.author} · {video.bvid || '無 BVID'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToSubmit(buildSubmitHref({ external_id: video.bvid, title: video.title }))}
                  style={{
                    backgroundColor: 'var(--bg-base)',
                    border: '1px solid var(--border-light)',
                    borderRadius: '99px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    padding: '8px 16px',
                    whiteSpace: 'nowrap',
                  }}
                >
                  採樣
                </button>
              </article>
            ))}
          </section>
        )}

        {!loading && searched && activeTab === 'users' && userResults.length === 0 && !message && (
          <section style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.8, marginTop: '32px', padding: '24px 0', textAlign: 'center' }}>
            沒有找到這位策展人。請確認審美號或名稱。
          </section>
        )}

        {activeTab === 'users' && userResults.length > 0 && (
          <section style={{ display: 'grid', gap: '20px', marginTop: '16px' }}>
            {userResults.map((profile) => {
              const displayName = profile.display_name || profile.username || '策展人';

              return (
                <button
                  key={profile.id}
                  type="button"
                  onClick={() => router.push(`/u/${profile.username}`)}
                  style={{ alignItems: 'center', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border-light)', cursor: 'pointer', display: 'flex', gap: '16px', padding: '0 0 20px 0', textAlign: 'left', width: '100%' }}
                >
                  <span style={{ alignItems: 'center', backgroundColor: 'var(--bg-base)', backgroundImage: profile.avatar_url ? `url(${profile.avatar_url})` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', border: '1px solid var(--border-light)', borderRadius: '50%', color: 'var(--text-secondary)', display: 'flex', flex: '0 0 auto', fontSize: '18px', fontWeight: 600, height: '52px', justifyContent: 'center', overflow: 'hidden', width: '52px' }}>
                    {!profile.avatar_url && displayName.charAt(0).toUpperCase()}
                  </span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ alignItems: 'center', color: 'var(--text-primary)', display: 'flex', fontSize: '16px', fontWeight: 600, gap: '8px', minWidth: 0 }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayName}</span>
                      <AestheteBadge role={profile.role} />
                    </span>
                    <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '13px', marginTop: '4px' }}>審美號：{profile.username}</span>
                    {profile.bio && <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '13px', marginTop: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profile.bio}</span>}
                  </span>
                </button>
              );
            })}
          </section>
        )}
      </main>
      <AppBottomNav active="search" />
    </div>
  );
}
