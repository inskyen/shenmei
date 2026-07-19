const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_AUTHOR_SHARE = 0.3;
const DOMINANT_AUTHOR_RELAXATION = 0.85;

export const RECOMMENDATION_REASON_LABELS = {
  channel_preference: '來自您偏好的頻道',
  following: '您追蹤的採樣人最近分享',
  fresh: '最近被放進採樣器',
  discussion: '正在引起一些交流',
  explore: '為您留一點隨機探索',
};

function hashString(input) {
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function deterministicRandom(seed, postId) {
  return hashString(`${seed}:${postId}`) / 4294967295;
}

function getPostModule(post) {
  const relation = Array.isArray(post.post_modules) ? post.post_modules[0] : null;
  const channel = relation?.modules || null;

  return channel ? { ...channel, id: channel.id || relation.module_id } : null;
}

function getFreshness(createdAt, now) {
  const timestamp = new Date(createdAt).getTime();
  if (!Number.isFinite(timestamp)) return 0;

  const ageInDays = Math.max(0, (now - timestamp) / DAY_IN_MS);
  return Math.exp(-ageInDays / 30);
}

function getRecommendationFreshness(post, now) {
  const createdAt = new Date(post.created_at).getTime();
  const updatedAt = new Date(post.updated_at).getTime();
  const activityAt = Math.max(
    Number.isFinite(createdAt) ? createdAt : 0,
    Number.isFinite(updatedAt) ? updatedAt : 0
  );

  return getFreshness(activityAt || post.created_at, now);
}

function getEngagement(post) {
  const weightedInteractions = Math.max(0, post.like_count || 0) + Math.max(0, post.comment_count || 0) * 2;
  return Math.min(1, Math.log1p(weightedInteractions) / Math.log(24));
}

function getAuthorKey(post) {
  return post.user_id || post.legacy_added_by || 'anonymous';
}

function getDynamicAuthorLimit(scoredPosts, limit) {
  const baseLimit = Math.max(2, Math.ceil(limit * MAX_AUTHOR_SHARE));
  if (scoredPosts.length === 0) return baseLimit;

  const counts = new Map();
  scoredPosts.forEach((post) => {
    const authorKey = getAuthorKey(post);
    counts.set(authorKey, (counts.get(authorKey) || 0) + 1);
  });

  const dominantCount = Math.max(...counts.values());
  const dominantShare = dominantCount / scoredPosts.length;
  if (dominantShare <= MAX_AUTHOR_SHARE) return baseLimit;

  return Math.max(baseLimit, Math.ceil(limit * dominantShare * DOMINANT_AUTHOR_RELAXATION));
}

function getChannelAffinity(preference) {
  if (preference === -2) return 0;
  if (preference === -1) return 0.2;
  if (preference === 1) return 0.78;
  if (preference === 2) return 1;
  return 0.5;
}

function selectReason({ channel, preference, isFollowing, freshness, engagement }) {
  if (channel && preference > 0) {
    const channelName = channel.name.endsWith('頻道') ? channel.name : `${channel.name}頻道`;
    return {
      code: 'channel_preference',
      label: `來自您偏好的${channelName}`,
    };
  }
  if (isFollowing) {
    return { code: 'following', label: RECOMMENDATION_REASON_LABELS.following };
  }
  if (freshness >= 0.82) {
    return { code: 'fresh', label: RECOMMENDATION_REASON_LABELS.fresh };
  }
  if (engagement >= 0.42) {
    return { code: 'discussion', label: RECOMMENDATION_REASON_LABELS.discussion };
  }
  return { code: 'explore', label: RECOMMENDATION_REASON_LABELS.explore };
}

export function scoreRecommendationCandidates({
  posts,
  seed,
  preferencesByModuleId = new Map(),
  followingUserIds = new Set(),
  excludedPostIds = new Set(),
  limit = 10,
  now = Date.now(),
}) {
  const scored = posts
    .filter((post) => post?.id && !excludedPostIds.has(post.id))
    .map((post) => {
      const channel = getPostModule(post);
      const preference = channel ? (preferencesByModuleId.get(channel.id) || 0) : 0;
      if (preference === -2) return null;

      const isFollowing = Boolean(post.user_id && followingUserIds.has(post.user_id));
      const freshness = getRecommendationFreshness(post, now);
      const engagement = getEngagement(post);
      const channelAffinity = getChannelAffinity(preference);
      const exploration = deterministicRandom(seed, post.id);
      const score = (
        exploration * 0.32
        + channelAffinity * 0.28
        + (isFollowing ? 1 : 0) * 0.18
        + freshness * 0.12
        + engagement * 0.10
      );
      const reason = selectReason({ channel, preference, isFollowing, freshness, engagement });

      return {
        ...post,
        recommendation: {
          channel,
          reason_code: reason.code,
          reason_label: reason.label,
          score,
        },
      };
    })
    .filter(Boolean);

  const remaining = [...scored];
  const selected = [];
  const authorCounts = new Map();
  const channelCounts = new Map();
  const selectedVideoIds = new Set();
  const authorLimit = getDynamicAuthorLimit(scored, limit);

  while (remaining.length > 0 && selected.length < limit) {
    let bestIndex = -1;
    let bestAdjustedScore = -Infinity;
    const hasAuthorBelowLimit = remaining.some((post) => {
      const authorKey = getAuthorKey(post);
      return (authorCounts.get(authorKey) || 0) < authorLimit;
    });

    remaining.forEach((post, index) => {
      const authorKey = getAuthorKey(post);
      const authorCount = authorCounts.get(authorKey) || 0;
      // 一次批量導入可能瞬間佔滿最近候選池。只要仍有其他發布者可選，
      // 就先讓不同的人輪流出現；內容不足時再自動放寬，不會造成空白頁。
      if (hasAuthorBelowLimit && authorCount >= authorLimit) return;

      const channelKey = post.recommendation.channel?.id || 'hall';
      const videoId = post.videos?.id;
      const duplicateVideoPenalty = videoId && selectedVideoIds.has(videoId) ? 1 : 0;
      const adjustedScore = (
        post.recommendation.score
        - authorCount * 0.18
        - (channelCounts.get(channelKey) || 0) * 0.12
        - duplicateVideoPenalty
      );

      if (adjustedScore > bestAdjustedScore) {
        bestAdjustedScore = adjustedScore;
        bestIndex = index;
      }
    });

    if (bestIndex < 0) break;
    const [nextPost] = remaining.splice(bestIndex, 1);
    const authorKey = getAuthorKey(nextPost);
    const channelKey = nextPost.recommendation.channel?.id || 'hall';
    const videoId = nextPost.videos?.id;

    if (videoId && selectedVideoIds.has(videoId)) continue;

    selected.push(nextPost);
    authorCounts.set(authorKey, (authorCounts.get(authorKey) || 0) + 1);
    channelCounts.set(channelKey, (channelCounts.get(channelKey) || 0) + 1);
    if (videoId) selectedVideoIds.add(videoId);
  }

  return selected;
}
