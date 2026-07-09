export default async function handler(req, res) {
  const { bvid, shortUrl } = req.query;

  let targetBvid = bvid;

  if (shortUrl) {
    try {
      const redirectRes = await fetch(shortUrl, { redirect: 'follow' });
      const finalUrl = redirectRes.url;
      const match = finalUrl.match(/BV[0-9A-Za-z]{10}/);
      if (match && match[0]) {
        targetBvid = match[0];
      } else {
        return res.status(400).json({ error: 'Could not resolve BVID from shortUrl' });
      }
    } catch (err) {
      console.error('Failed to resolve shortUrl:', err);
      return res.status(500).json({ error: 'Failed to resolve shortUrl' });
    }
  }

  if (!targetBvid || !targetBvid.startsWith('BV')) {
    return res.status(400).json({ error: 'Missing or invalid BVID' });
  }

  try {
    const response = await fetch(`https://api.bilibili.com/x/web-interface/view?bvid=${targetBvid}`);
    const data = await response.json();

    if (data.code === 0 && data.data) {
      const { title, pic, owner } = data.data;
      
      // B站返回的图片通常是 http 开头，替换为 https 以避免 mixed content 报错
      const securePic = pic ? pic.replace(/^http:\/\//i, 'https://') : '';

      return res.status(200).json({
        bvid: targetBvid,
        title,
        cover: securePic,
        author: owner?.name || '',
      });
    }

    return res.status(404).json({ error: 'Video not found or API error', details: data });
  } catch (error) {
    console.error('Failed to fetch bilibili info:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
