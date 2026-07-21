import { createClient } from '@supabase/supabase-js';

const BILIBILI_VIEW_API = 'https://api.bilibili.com/x/web-interface/view';
const TARGET_MODULE_NAME = 'B站2021';

function createAnonClient(authorization) {
  const options = {
    auth: { autoRefreshToken: false, persistSession: false },
  };

  if (authorization?.startsWith('Bearer ')) {
    options.global = { headers: { Authorization: authorization } };
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    options
  );
}

function createServiceClient() {
  const serviceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('Missing Supabase service key');
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    serviceKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function loadCurrentUser(database, authorization) {
  if (!authorization?.startsWith('Bearer ')) return null;

  const accessToken = authorization.slice('Bearer '.length);
  const { data, error } = await database.auth.getUser(accessToken);
  if (error) return null;
  return data?.user || null;
}

async function isBilibili2021OrEarlier(bvid) {
  const response = await fetch(`${BILIBILI_VIEW_API}?bvid=${encodeURIComponent(bvid)}`);
  if (!response.ok) {
    throw new Error(`Bilibili lookup failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const pubdate = Number(payload?.data?.pubdate);
  if (payload?.code !== 0 || !Number.isFinite(pubdate) || pubdate <= 0) {
    throw new Error('Bilibili lookup returned no valid pubdate');
  }

  return new Date(pubdate * 1000).getUTCFullYear() <= 2021;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { postId } = req.body || {};
  if (!postId || typeof postId !== 'string') {
    return res.status(400).json({ error: 'Missing postId' });
  }

  try {
    const authorization = req.headers.authorization;
    const requestClient = createAnonClient(authorization);
    const currentUser = await loadCurrentUser(requestClient, authorization);
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const serviceClient = createServiceClient();
    const { data: post, error: postError } = await serviceClient
      .from('posts')
      .select('id,user_id,videos(source_platform,external_id)')
      .eq('id', postId)
      .maybeSingle();

    if (postError) throw postError;
    if (!post || post.user_id !== currentUser.id) {
      return res.status(404).json({ error: 'Post not found' });
    }

    const video = post.videos;
    if (video?.source_platform !== 'bilibili' || !video?.external_id) {
      return res.status(400).json({ error: 'Post is not a Bilibili video' });
    }

    const shouldAssign = await isBilibili2021OrEarlier(video.external_id);
    if (!shouldAssign) {
      return res.status(200).json({ assigned: false });
    }

    const { data: targetModule, error: moduleError } = await serviceClient
      .from('modules')
      .select('id,slug,name')
      .eq('status', 'active')
      .eq('name', TARGET_MODULE_NAME)
      .maybeSingle();

    if (moduleError) throw moduleError;
    if (!targetModule) {
      return res.status(404).json({ error: `Module ${TARGET_MODULE_NAME} not found` });
    }

    const { error: linkError } = await serviceClient
      .from('post_modules')
      .upsert(
        { post_id: post.id, module_id: targetModule.id, added_by: currentUser.id },
        { onConflict: 'post_id' }
      );

    if (linkError) throw linkError;

    return res.status(200).json({ assigned: true, module: targetModule });
  } catch (error) {
    console.error('Failed to assign Bilibili 2021 module:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
