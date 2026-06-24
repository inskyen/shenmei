import { useState, useEffect } from 'react';

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(null);

  useEffect(() => {
    fetch('/api/videos')
      .then(r => r.json())
      .then(data => {
        setVideos(data.videos || []);
        setLoading(false);
      });
  }, []);

  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  function formatPlay(n) {
    if (n >= 10000) return (n / 10000).toFixed(1) + '万';
    return n.toString();
  }

  return (
    <div style={{ background: '#f5f2ec', minHeight: '100vh', fontFamily: 'Georgia, serif' }}>
      <header style={{
        padding: '1.5rem',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        display: 'flex',
        alignItems: 'baseline',
        gap: '1rem'
      }}>
        <span style={{ fontSize: '1.4rem', fontWeight: 300, letterSpacing: '0.12em' }}>审美者</span>
        <span style={{ fontSize: '0.65rem', letterSpacing: '0.3em', color: '#9a9488', fontFamily: 'Helvetica Neue, sans-serif' }}>AESTHETE</span>
        <span style={{ marginLeft: 'auto', fontSize: '0.7rem', color: '#9a9488', fontFamily: 'Helvetica Neue, sans-serif' }}>
          {videos.length > 0 && `${videos.length} 条`}
        </span>
      </header>

      {loading && (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#9a9488', fontSize: '0.8rem', letterSpacing: '0.2em' }}>
          正在加载片单…
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '1.5rem',
        padding: '2rem',
        maxWidth: '1200px',
        margin: '0 auto'
      }}>
        {videos.map(v => (
          <div
            key={v.bvid}
            onClick={() => setActive(active === v.bvid ? null : v.bvid)}
            style={{
              background: '#fff',
              borderRadius: '4px',
              overflow: 'hidden',
              cursor: 'pointer',
              border: '1px solid rgba(0,0,0,0.05)',
              gridColumn: active === v.bvid ? '1 / -1' : 'auto',
              display: active === v.bvid ? 'grid' : 'block',
              gridTemplateColumns: active === v.bvid ? '1fr 1fr' : '1fr',
            }}
          >
            {active === v.bvid ? (
              <iframe
                src={`https://player.bilibili.com/player.html?bvid=${v.bvid}&autoplay=1`}
                style={{ width: '100%', aspectRatio: '16/9', border: 'none' }}
                allowFullScreen
              />
            ) : (
              <img
                src={v.cover}
                alt={v.title}
                referrerPolicy="no-referrer"
                style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', display: 'block' }}
              />
            )}
            <div style={{ padding: '1rem' }}>
              <div style={{ fontSize: '0.65rem', color: '#5c6b4a', letterSpacing: '0.1em', marginBottom: '0.4rem', fontFamily: 'Helvetica Neue, sans-serif' }}>
                {v.upper?.name}
              </div>
              <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: '#1a1a18' }}>
                {v.title}
              </div>
              <div style={{ marginTop: '0.6rem', fontSize: '0.7rem', color: '#9a9488', fontFamily: 'Helvetica Neue, sans-serif', display: 'flex', gap: '1rem' }}>
                <span>{formatDuration(v.duration)}</span>
                <span>{formatPlay(v.cnt_info?.play || 0)} 播放</span>
              </div>
              {active === v.bvid && (
                <button
                  onClick={e => { e.stopPropagation(); setActive(null); }}
                  style={{ marginTop: '1rem', fontSize: '0.7rem', letterSpacing: '0.2em', color: '#9a9488', background: 'none', border: '1px solid rgba(0,0,0,0.1)', padding: '0.4rem 0.8rem', cursor: 'pointer', borderRadius: '2px' }}
                >
                  收起 ↑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}