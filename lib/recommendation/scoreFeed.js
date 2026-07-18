const DAY_IN_MS = 24 * 60 * 60 * 1000;
const MAX_AUTHOR_SHARE = 0.3;

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

function getEngagement(post) {
  const weightedInteractions = Math.max(0, post.like_count || 0) + Math.max(0, post.comment_count || 0) * 2;
  return Math.min(1, Math.log1p(weightedInteractions) / Math.log(24));
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
      const freshness = getFreshness(post.created_at, now);
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
  const authorLimit = Math.max(2, Math.ceil(limit * MAX_AUTHOR_SHARE));

  while (remaining.length > 0 && selected.length < limit) {
    let bestIndex = -1;
    let bestAdjustedScore = -Infinity;
    const hasAuthorBelowLimit = remaining.some((post) => {
      const authorKey = post.user_id || post.legacy_added_by || 'anonymous';
      return (authorCounts.get(authorKey) || 0) < authorLimit;
    });

    remaining.forEach((post, index) => {
      const authorKey = post.user_id || post.legacy_added_by || 'anonymous';
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
    const authorKey = nextPost.user_id || nextPost.legacy_added_by || 'anonymous';
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
