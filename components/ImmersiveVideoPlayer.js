import { useEffect } from 'react';

export default function ImmersiveVideoPlayer({ video, onClose }) {
  useEffect(() => {
    if (!video) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, video]);

  if (!video) return null;

  const bvid = video.bvid || video.external_id;
  const title = video.title || video.video_title || '未命名影片';
  const authorName = video.up_name || video.author_name;

  return (
    <div
      aria-label={`播放影片：${title}`}
      aria-modal="true"
      role="dialog"
      style={{ alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.9)', bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', left: 0, position: 'fixed', right: 0, top: 0, zIndex: 9999 }}
    >
      <button
        type="button"
        aria-label="關閉播放器"
        onClick={onClose}
        style={{ alignItems: 'center', backdropFilter: 'blur(4px)', backgroundColor: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '50%', color: '#FFFFFF', cursor: 'pointer', display: 'flex', fontSize: '20px', height: '40px', justifyContent: 'center', padding: 0, position: 'absolute', right: '24px', top: '24px', width: '40px', zIndex: 1 }}
      >
        ✕
      </button>

      <div style={{ maxWidth: '800px', width: '100%' }}>
        <div style={{ backgroundColor: '#000', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', paddingTop: '56.25%', position: 'relative', width: '100%' }}>
          {bvid ? (
            <iframe
              allow="autoplay; fullscreen"
              allowFullScreen
              frameBorder="no"
              scrolling="no"
              src={`//player.bilibili.com/player.html?bvid=${bvid}&page=1&autoplay=1&high_quality=1&danmaku=1&loop=1`}
              style={{ border: 'none', height: '100%', left: 0, position: 'absolute', top: 0, width: '100%' }}
              title={title}
            />
          ) : (
            <span style={{ alignItems: 'center', color: 'rgba(255,255,255,0.65)', display: 'flex', fontSize: '14px', height: '100%', justifyContent: 'center', left: 0, position: 'absolute', top: 0, width: '100%' }}>
              這支影片暫時無法播放。
            </span>
          )}
        </div>

        <div style={{ color: '#FFFFFF', marginTop: '20px', padding: '0 24px', textAlign: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 500, letterSpacing: '0.5px', margin: '0 0 8px' }}>{title}</h2>
          {authorName && <div style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '13px' }}>@{authorName}</div>}
        </div>
      </div>
    </div>
  );
}
