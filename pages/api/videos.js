export default async function handler(req, res) {
  const MEDIA_ID = '2820721799';
  
  try {
    const response = await fetch(
      `https://api.bilibili.com/x/v3/fav/resource/list?media_id=${MEDIA_ID}&pn=1&ps=20&type=2`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.bilibili.com'
        }
      }
    );
    
    const data = await response.json();
    const medias = (data?.data?.medias || []).map(item => ({
    ...item,
    cover: item.cover?.replace('http://', 'https://')
    }));
    
    res.status(200).json({ videos: medias });
    
  } catch (err) {
    res.status(500).json({ error: '加载失败' });
  }
}