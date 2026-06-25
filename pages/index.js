import { useEffect, useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 状态 1：点击视频封面 -> 触发全屏沉浸模式
  const [immersiveVideo, setImmersiveVideo] = useState(null);
  
  // 状态 2：点击文字区域 -> 触发图文详情单页
  const [detailPageVideo, setDetailPageVideo] = useState(null);

  useEffect(() => {
    fetch('/api/videos')
      .then(res => res.json())
      .then(data => {
        setVideos(data.videos || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, []);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp.toString().length === 10 ? timestamp * 1000 : timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  return (
    <div style={{ backgroundColor: '#F8FAFC', minHeight: '100vh', color: '#2C3E50', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <Head>
        <title>审美者 · AESTHETE</title>
      </Head>

      <header style={{ 
        backgroundColor: '#FFFFFF', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 10,
        boxShadow: '0 2px 10px rgba(184, 212, 232, 0.15)'
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, textAlign: 'center', color: '#2C3E50', letterSpacing: '1px' }}>
          审美者 <span style={{ fontSize: '12px', color: '#B8D4E8', fontWeight: 'normal', letterSpacing: '2px' }}>AESTHETE</span>
        </h1>
      </header>

      <main style={{ maxWidth: '600px', margin: '0 auto', padding: '20px 16px', paddingBottom: '80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', color: '#B8D4E8', padding: '40px', fontSize: '14px' }}>美好正在加载...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {videos.map((video) => (
              
              <article 
                key={video.id || video.bvid} 
                style={{ 
                  backgroundColor: '#FFFFFF', borderRadius: '16px', overflow: 'hidden', 
                  boxShadow: '0 4px 20px rgba(184, 212, 232, 0.25)'
                }}
              >
                {/* 交互区 A：点击头部文字 -> 进入单页详情 */}
                <div 
                  onClick={() => setDetailPageVideo(video)}
                  style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer' }}
                >
                  <div style={{ 
                    width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#B8D4E8', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 'bold', fontSize: '14px', marginRight: '12px' 
                  }}>
                    {video.added_by ? video.added_by.charAt(0) : '天'}
                  </div>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: '#6B9AB8' }}>{video.added_by || '小天'}</div>
                    <div style={{ fontSize: '12px', color: '#B8D4E8', marginTop: '2px' }}>{formatDate(video.fav_time || video.created_at)}</div>
                  </div>
                </div>

                {/* 交互区 B：点击视频封面 -> 进入全屏沉浸播放 */}
                <div 
                  onClick={() => setImmersiveVideo(video)}
                  style={{ display: 'block', position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000000', cursor: 'pointer' }}
                >
                  <img src={video.cover} alt={video.title} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '44px', height: '44px', backgroundColor: 'rgba(44, 62, 80, 0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                    <div style={{ width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '14px solid #FFFFFF', marginLeft: '4px' }}></div>
                  </div>
                </div>

                {/* 交互区 C：点击底部文字 -> 进入单页详情 */}
                <div 
                  onClick={() => setDetailPageVideo(video)}
                  style={{ padding: '16px', cursor: 'pointer' }}
                >
                  <h2 style={{ fontSize: '15px', fontWeight: '500', margin: '0 0 10px 0', lineHeight: '1.6', color: '#2C3E50' }}>{video.title}</h2>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#6B9AB8' }}>
                    <span>{video.up_name || 'UP主'}</span>
                    <span>{video.duration ? `${video.duration}` : ''} {video.play_count ? ` · ${video.play_count} 播放` : ''}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* 浮层 1：黑底全屏沉浸式（视频放大） */}
      {immersiveVideo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: '#000000', zIndex: 9999
        }}>
          <div onClick={() => setImmersiveVideo(null)} style={{ position: 'absolute', top: '24px', left: '16px', zIndex: 10000, width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', cursor: 'pointer', backdropFilter: 'blur(4px)', fontSize: '18px' }}>✕</div>
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <iframe src={`//player.bilibili.com/player.html?bvid=${immersiveVideo.bvid}&page=1&autoplay=1&high_quality=1&danmaku=1`} scrolling="no" border="0" frameBorder="no" framespacing="0" allowFullScreen={true} style={{ width: '100%', height: '100%', border: 'none' }}></iframe>
          </div>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '60px 20px 30px', background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)', pointerEvents: 'none' }}>
            <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#FFFFFF', marginBottom: '8px' }}>@{immersiveVideo.up_name}</div>
            <h2 style={{ fontSize: '14px', fontWeight: 'normal', margin: 0, lineHeight: '1.5', color: 'rgba(255, 255, 255, 0.9)' }}>{immersiveVideo.title}</h2>
          </div>
        </div>
      )}

      {/* 浮层 2：白底单页详情式（带评论区占位） */}
      {detailPageVideo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: '#F8FAFC', zIndex: 999, overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', backgroundColor: '#FFFFFF', position: 'sticky', top: 0, boxShadow: '0 2px 10px rgba(184, 212, 232, 0.15)' }}>
            <div onClick={() => setDetailPageVideo(null)} style={{ padding: '8px', cursor: 'pointer', color: '#6B9AB8', fontWeight: '500' }}>← 返回</div>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#2C3E50', paddingRight: '40px' }}>动态详情</div>
          </div>
          <div style={{ padding: '20px' }}>
            <iframe src={`//player.bilibili.com/player.html?bvid=${detailPageVideo.bvid}&page=1&autoplay=1&high_quality=1`} scrolling="no" border="0" frameBorder="no" framespacing="0" allowFullScreen={true} style={{ width: '100%', aspectRatio: '16/9', borderRadius: '12px', backgroundColor: '#000', border: 'none' }}></iframe>
            <h2 style={{ fontSize: '18px', marginTop: '20px', color: '#2C3E50', lineHeight: '1.5' }}>{detailPageVideo.title}</h2>
            <div style={{ color: '#6B9AB8', fontSize: '14px', marginTop: '10px' }}>UP主：{detailPageVideo.up_name}</div>
            <div style={{ marginTop: '40px', padding: '30px 20px', textAlign: 'center', color: '#B8D4E8', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px dashed #B8D4E8' }}>
              评论区等基建准备中...
            </div>
          </div>
        </div>
      )}
    </div>
  );
}