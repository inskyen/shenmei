import { useEffect, useState } from 'react';

export default function ImmersiveVideoPlayer({ video, onClose }) {
  const [videoDimension, setVideoDimension] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  useEffect(() => {
    if (!video) return undefined;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    if (video.bvid || video.external_id) {
      const targetBvid = video.bvid || video.external_id;
      fetch(`/api/bilibili?bvid=${targetBvid}`)
        .then(res => res.json())
        .then(data => {
          if (data.dimension) {
            setVideoDimension(data.dimension);
          }
        })
        .catch(err => console.warn('無法獲取影片尺寸:', err));
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, video]);

  if (!video) return null;

  const bvid = video.bvid || video.external_id;
  const title = video.title || video.video_title || '未命名影片';
  const authorName = video.up_name || video.author_name;
  const coverUrl = video.cover || video.cover_url || video.pic;

  return (
    <div
      aria-label={`播放影片：${title}`}
      aria-modal="true"
      role="dialog"
      onClick={onClose}
      style={{ alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.9)', bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', left: 0, position: 'fixed', right: 0, top: 0, zIndex: 9999 }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px', width: '100%' }}>
        <div style={{ 
          backgroundColor: '#000', 
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)', 
          position: 'relative', 
          width: '100%',
          ...(videoDimension && videoDimension.height > videoDimension.width ? {
            height: '80vh',
            maxHeight: '800px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center'
          } : {
            paddingTop: '56.25%'
          })
        }}>
          {!isPlaying ? (
            <div 
              onClick={() => setIsPlaying(true)}
              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }}
            >
              {coverUrl && (
                <img 
                  src={coverUrl} 
                  alt={title}
                  referrerPolicy="no-referrer"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              )}
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '64px', height: '64px', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="white" style={{ marginLeft: '4px' }}>
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          ) : (
            bvid ? (
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
            )
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
