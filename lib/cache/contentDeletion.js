import { adjustFollowingPostCommentCount, clearFollowingFeedCache } from '@/lib/cache/followingFeedCache';
import { adjustHomeFeedPostCommentCount, removePostFromHomeFeed } from '@/lib/cache/homeFeedCache';
import { adjustModulePostCommentCount, removePostFromModuleCaches } from '@/lib/cache/modulePageCache';
import { adjustCachedPostCommentCount, removeCachedPostDetail } from '@/lib/cache/postDetailCache';
import { adjustProfilePostCommentCount, clearProfilePageCache } from '@/lib/cache/profilePageCache';

export function removeDeletedPostFromCaches(postId) {
  removePostFromHomeFeed(postId);
  clearFollowingFeedCache();
  removePostFromModuleCaches(postId);
  removeCachedPostDetail(postId);
  clearProfilePageCache();
}

export function adjustPostCommentCountInCaches(postId, delta) {
  adjustHomeFeedPostCommentCount(postId, delta);
  adjustFollowingPostCommentCount(postId, delta);
  adjustModulePostCommentCount(postId, delta);
  adjustCachedPostCommentCount(postId, delta);
  adjustProfilePostCommentCount(postId, delta);
}
