import { useEffect, useState } from 'react';
import Head from 'next/head';

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 状态 1：点击视频封面 -> 触发居中悬浮播放（暗黑背景）
  const [immersiveVideo, setImmersiveVideo] = useState(null);
  
  // 状态 2：点击文字区域 -> 触发图文详情单页
  const [detailPageVideo, setDetailPageVideo] = useState(null);

  // 初始化加载数据
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

  // 核心魔法：监听浏览器返回事件（处理手机侧滑返回）
  useEffect(() => {
    const handlePopState = () => {
      if (immersiveVideo) setImmersiveVideo(null);
      if (detailPageVideo) setDetailPageVideo(null);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [immersiveVideo, detailPageVideo]);

  // 打开私人放映室
  const openImmersive = (video) => {
    window.history.pushState({ modal: true }, "");
    setImmersiveVideo(video);
  };

  // 关闭私人放映室
  const closeImmersive = () => {
    setImmersiveVideo(null);
    if (window.history.state && window.history.state.modal) {
      window.history.back();
    }
  };

  // 打开详情页
  const openDetailPage = (video) => {
    window.history.pushState({ modal: true }, "");
    setDetailPageVideo(video);
  };

  // 关闭详情页
  const closeDetailPage = () => {
    setDetailPageVideo(null);
    if (window.history.state && window.history.state.modal) {
      window.history.back();
    }
  };

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
                  onClick={() => openDetailPage(video)}
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

                {/* 交互区 B：点击视频封面 -> 进入居中悬浮播放 */}
                <div 
                  onClick={() => openImmersive(video)}
                  style={{ display: 'block', position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000000', cursor: 'pointer' }}
                >
                  <img src={video.cover} alt={video.title} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '44px', height: '44px', backgroundColor: 'rgba(44, 62, 80, 0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' }}>
                    <div style={{ width: 0, height: 0, borderTop: '8px solid transparent', borderBottom: '8px solid transparent', borderLeft: '14px solid #FFFFFF', marginLeft: '4px' }}></div>
                  </div>
                </div>

                {/* 交互区 C：点击底部文字 -> 进入单页详情 */}
                <div 
                  onClick={() => openDetailPage(video)}
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

      {/* 浮层 1：私人放映室（居中悬浮模式 - 已追加自动自动循环播放及权限控制） */}
      {immersiveVideo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: 'rgba(0, 0, 0, 0.9)', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
        }}>
          <div 
            onClick={closeImmersive} 
            style={{ 
              position: 'absolute', top: '24px', right: '24px', zIndex: 10000, 
              width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgba(255, 255, 255, 0.1)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: '#FFFFFF', cursor: 'pointer', backdropFilter: 'blur(4px)', fontSize: '20px' 
            }}
          >✕</div>
          
          <div style={{ width: '100%', maxWidth: '800px', padding: '0 16px' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
              {/* URL 结尾追加了 &loop=1 ，并且增加了 allow="autoplay; fullscreen" 授权 */}
              <iframe 
                src={`//player.bilibili.com/player.html?bvid=${immersiveVideo.bvid}&page=1&autoplay=1&high_quality=1&danmaku=1&loop=1`} 
                scrolling="no" border="0" frameBorder="no" framespacing="0" allowFullScreen={true} allow="autoplay; fullscreen"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              ></iframe>
            </div>
            <div style={{ marginTop: '20px', color: '#FFFFFF', textAlign: 'center' }}>
              <h2 style={{ fontSize: '16px', fontWeight: '500', margin: '0 0 8px 0', letterSpacing: '0.5px' }}>{immersiveVideo.title}</h2>
              <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.6)' }}>@{immersiveVideo.up_name}</div>
            </div>
          </div>
        </div>
      )}

      {/* 浮层 2：白底单页详情式 */}
      {detailPageVideo && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
          backgroundColor: '#F8FAFC', zIndex: 999, overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', backgroundColor: '#FFFFFF', position: 'sticky', top: 0, boxShadow: '0 2px 10px rgba(184, 212, 232, 0.15)' }}>
            <div onClick={closeDetailPage} style={{ padding: '8px', cursor: 'pointer', color: '#6B9AB8', fontWeight: '500' }}>← 返回</div>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', color: '#2C3E50', paddingRight: '40px' }}>动态详情</div>
          </div>
          <div style={{ padding: '20px' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden' }}>
              {/* 这里同样追加了 &loop=1 和 自动播放授权 */}
              <iframe 
                src={`//player.bilibili.com/player.html?bvid=${detailPageVideo.bvid}&page=1&autoplay=1&high_quality=1&loop=1`} 
                scrolling="no" border="0" frameBorder="no" framespacing="0" allowFullScreen={true} allow="autoplay; fullscreen"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
              ></iframe>
            </div>
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