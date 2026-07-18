import { createClient } from '@supabase/supabase-js';
import { mapPostToFeedItem } from '@/lib/feed/mapPostToFeedItem';
import { scoreRecommendationCandidates } from '@/lib/recommendation/scoreFeed';

const MAX_LIMIT = 20;
const RECENT_CANDIDATE_LIMIT = 180;
const EXPLORATION_CANDIDATE_LIMIT = 80;
const MAX_EXCLUDED_IDS = 160;
const CANDIDATE_SELECT = `
  id,
  user_id,
  legacy_added_by,
  note,
  created_at,
  like_count,
  comment_count,
  profiles (
    id,
    username,
    display_name,
    avatar_url,
    role
  ),
  videos (
    id,
    external_id,
    title,
    cover_url,
    author_name
  ),
  post_modules (
    module_id,
    modules (
      id,
      name,
      slug
    )
  )
`;

function createRequestClient(req) {
  const authorization = req.headers.authorization;
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

function numericSeed(seed) {
  let value = 0;
  for (let index = 0; index < seed.length; index += 1) {
    value = (Math.imul(value, 31) + seed.charCodeAt(index)) >>> 0;
  }
  return value;
}

function parseExcludedIds(value) {
  if (typeof value !== 'string' || !value.trim()) return [];

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => /^[0-9a-f-]{36}$/i.test(item))
    .slice(0, MAX_EXCLUDED_IDS);
}

async function loadCurrentUser(database, authorization) {
  if (!authorization?.startsWith('Bearer ')) return null;

  const accessToken = authorization.slice('Bearer '.length);
  const { data, error } = await database.auth.getUser(accessToken);
  if (error) return null;
  return data?.user || null;
}

async function loadCandidates(database, seed) {
  const baseQuery = () => database
    .from('posts')
    .select(CANDIDATE_SELECT)
    .eq('status', 'published')
    .eq('visibility', 'public');

  const countQuery = database
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('visibility', 'public');

  const recentQuery = baseQuery()
    .order('created_at', { ascending: false })
    .limit(RECENT_CANDIDATE_LIMIT);

  const [{ count, error: countError }, recentResult] = await Promise.all([countQuery, recentQuery]);
  if (countError) throw countError;
  if (recentResult.error) throw recentResult.error;

  const totalCount = count || 0;
  if (totalCount <= RECENT_CANDIDATE_LIMIT) {
    return recentResult.data || [];
  }

  const maxStart = Math.max(0, totalCount - EXPLORATION_CANDIDATE_LIMIT);
  const explorationStart = maxStart > 0 ? numericSeed(seed) % (maxStart + 1) : 0;
  const explorationResult = await baseQuery()
    .order('created_at', { ascending: false })
    .range(explorationStart, explorationStart + EXPLORATION_CANDIDATE_LIMIT - 1);

  if (explorationResult.error) throw explorationResult.error;

  const postsById = new Map();
  [...(recentResult.data || []), ...(explorationResult.data || [])].forEach((post) => {
    if (post?.id && !postsById.has(post.id)) postsById.set(post.id, post);
  });
  return [...postsById.values()];
}

async function loadPersonalSignals(database, user) {
  if (!user) {
    return {
      preferencesByModuleId: new Map(),
      followingUserIds: new Set(),
      recentImpressionIds: new Set(),
    };
  }

  const recentThreshold = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const [preferenceResult, followResult, impressionResult] = await Promise.all([
    database
      .from('user_channel_preferences')
      .select('module_id,preference')
      .eq('user_id', user.id),
    database
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id),
    database
      .from('feed_impressions')
      .select('post_id')
      .eq('user_id', user.id)
      .gte('shown_at', recentThreshold)
      .order('shown_at', { ascending: false })
      .limit(120),
  ]);

  const ignorableTableCodes = new Set(['42P01', 'PGRST205']);
  if (preferenceResult.error && !ignorableTableCodes.has(preferenceResult.error.code)) {
    throw preferenceResult.error;
  }
  if (followResult.error) throw followResult.error;
  if (impressionResult.error && !ignorableTableCodes.has(impressionResult.error.code)) {
    throw impressionResult.error;
  }

  return {
    preferencesByModuleId: new Map(
      (preferenceResult.data || []).map((item) => [item.module_id, item.preference])
    ),
    followingUserIds: new Set((followResult.data || []).map((item) => item.following_id)),
    recentImpressionIds: new Set((impressionResult.data || []).map((item) => item.post_id)),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Math.min(Math.max(Number.isFinite(requestedLimit) ? requestedLimit : 10, 1), MAX_LIMIT);
    const seed = typeof req.query.seed === 'string' && req.query.seed
      ? req.query.seed.slice(0, 80)
      : `${Date.now()}`;
    const sessionId = typeof req.query.session_id === 'string'
      ? req.query.session_id.slice(0, 100)
      : seed;
    const excludedIds = parseExcludedIds(req.query.exclude);
    const database = createRequestClient(req);
    // 候選內容不依賴登入身份，先與 Auth 校驗並行啟動，
    // 避免登入使用者每次刷新都串行等待兩輪網路請求。
    const postsPromise = loadCandidates(database, seed);
    const user = await loadCurrentUser(database, req.headers.authorization);
    const [posts, personalSignals] = await Promise.all([
      postsPromise,
      loadPersonalSignals(database, user),
    ]);
    const excludedPostIds = new Set([
      ...excludedIds,
      ...personalSignals.recentImpressionIds,
    ]);
    let selected = scoreRecommendationCandidates({
      posts,
      seed,
      preferencesByModuleId: personalSignals.preferencesByModuleId,
      followingUserIds: personalSignals.followingUserIds,
      excludedPostIds,
      limit,
    });

    // 小型社区可能在两周内已经看遍大部分内容；此时只保留本批明确排除项，
    // 允许旧内容重新流动，而不是返回空白推荐页。
    if (
      selected.length < Math.min(4, limit)
      && (personalSignals.recentImpressionIds.size > 0 || excludedIds.length > 0)
    ) {
      selected = scoreRecommendationCandidates({
        posts,
        seed,
        preferencesByModuleId: personalSignals.preferencesByModuleId,
        followingUserIds: personalSignals.followingUserIds,
        excludedPostIds: new Set(excludedIds),
        limit,
      });
    }

    res.setHeader('Cache-Control', 'private, no-store');
    return res.status(200).json({
      items: selected.map(mapPostToFeedItem),
      has_more: selected.length === limit && posts.length > selected.length,
      seed,
      session_id: sessionId,
      personalized: Boolean(user),
    });
  } catch (error) {
    console.error('推薦資料載入錯誤:', error);
    return res.status(500).json({ error: '推薦暫時無法載入' });
  }
}
