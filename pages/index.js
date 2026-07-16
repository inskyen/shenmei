import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import AestheteBadge from '@/components/AestheteBadge';
import ImmersiveVideoPlayer from '@/components/ImmersiveVideoPlayer';
import { requireLogin } from '@/lib/auth/requireLogin';
import { showToast } from '@/lib/ui/toast';
import { cachePostPreview } from '@/lib/cache/postDetailCache';
import { getCachedFollowingFeed, prefetchFollowingFeed } from '@/lib/cache/followingFeedCache';
import { cacheHomeFeed, getCachedHomeFeed } from '@/lib/cache/homeFeedCache';
import { prefetchMessageInbox } from '@/lib/cache/messagePageCache';
import { getCachedModules, prefetchModulePage, prefetchModules } from '@/lib/cache/modulePageCache';
import { prefetchProfilePage } from '@/lib/cache/profilePageCache';
import { cacheProfileRoute } from '@/lib/auth/profileRoute';
import { loadUnreadNotificationCount } from '@/lib/notifications/userNotifications';
import { loadLikedPostIds, togglePostLike } from '@/lib/reactions/postLikes';
import { supabase } from '@/lib/supabase/client';

const FEED_PAGE_SIZE = 10;
const HOME_SECTIONS = ['following', 'latest', 'modules'];

const MODULE_GRADIENTS = [
  ['#C1693A', '#E8A87C'],
  ['#3A2D6B', '#7B5EA7'],
  ['#1A4A3A', '#3D8B6E'],
  ['#2C4A6B', '#5B8DB8'],
  ['#6B2D3A', '#B85B6B'],
  ['#3A4A2D', '#7A8B5E'],
  ['#4A3A1A', '#8B7A3D'],
  ['#1A3A5C', '#3D7AB8'],
];

function normalizeCachedFeed(cachedFeed) {
  if (Array.isArray(cachedFeed)) {
    return {
      items: cachedFeed,
      hasMore: true,
      nextOffset: cachedFeed.length,
    };
  }

  return cachedFeed;
}

function mergeFeedItems(primaryItems, secondaryItems) {
  const itemsById = new Map();

  [...primaryItems, ...secondaryItems].forEach((item) => {
    const itemKey = item.post_id || item.id || item.bvid;
    if (itemKey && !itemsById.has(itemKey)) {
      itemsById.set(itemKey, item);
    }
  });

  return [...itemsById.values()];
}

async function fetchFeedPage(offset) {
  const response = await fetch(`/api/feed?offset=${offset}&limit=${FEED_PAGE_SIZE}`);
  if (!response.ok) throw new Error('最新策展載入失敗');
  return response.json();
}

function normalizeFollowingPosts(feed) {
  return (feed?.posts || []).map((post) => ({
    post_id: post.id,
    video_id: post.videos?.id,
    bvid: post.videos?.external_id,
    title: post.note,
    video_title: post.videos?.title,
    cover: post.videos?.cover_url,
    up_name: post.videos?.author_name,
    play_count: post.like_count || 0,
    comment_count: post.comment_count || 0,
    fav_time: post.created_at,
    created_at: post.created_at,
    added_by: post.profile?.display_name || post.profile?.username || '策展人',
    profile_avatar_url: post.profile?.avatar_url || null,
    profile_username: post.profile?.username || null,
    profile_role: post.profile?.role || null,
  }));
}

function getModuleCardBackground(module) {
  const coverUrl = module.cover_url || module.latest_cover_url;
  if (coverUrl) {
    return {
      backgroundImage: `url(${coverUrl})`,
      backgroundPosition: 'center',
      backgroundSize: 'cover',
    };
  }

  if (module.theme_color) {
    return { background: `linear-gradient(145deg, ${module.theme_color}CC, ${module.theme_color}66)` };
  }

  const slug = module.slug || module.name || '';
  const hash = [...slug].reduce((value, character) => character.charCodeAt(0) + ((value << 5) - value), 0);
  const [from, to] = MODULE_GRADIENTS[Math.abs(hash) % MODULE_GRADIENTS.length];
  return { background: `linear-gradient(145deg, ${from}, ${to})` };
}

export default function Home() {
  const router = useRouter();
  const [initialFollowingFeed] = useState(() => getCachedFollowingFeed());
  const [initialFeed] = useState(() => normalizeCachedFeed(getCachedHomeFeed()));
  const initialFeedRef = useRef(initialFeed);
  const [videos, setVideos] = useState(() => initialFeed?.items || []);
  const [loading, setLoading] = useState(() => !initialFeed?.items?.length);
  const [hasMoreFeed, setHasMoreFeed] = useState(() => initialFeed?.hasMore ?? true);
  const [nextFeedOffset, setNextFeedOffset] = useState(() => initialFeed?.nextOffset || 0);
  const [loadingMoreFeed, setLoadingMoreFeed] = useState(false);
  const [activeSection, setActiveSection] = useState('latest');
  const [sectionMotion, setSectionMotion] = useState('none');
  const [followingVideos, setFollowingVideos] = useState(() => normalizeFollowingPosts(initialFollowingFeed));
  const [followingLoading, setFollowingLoading] = useState(() => !initialFollowingFeed);
  const [followingRequiresLogin, setFollowingRequiresLogin] = useState(() => Boolean(initialFollowingFeed?.requiresLogin));
  const [modules, setModules] = useState(() => getCachedModules() || []);
  const [modulesLoading, setModulesLoading] = useState(() => !getCachedModules());
  const [likedPostIds, setLikedPostIds] = useState(new Set());
  const [likingPostIds, setLikingPostIds] = useState(new Set());
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [showBackToTop, setShowBackToTop] = useState(false);
  // 身份與 Profile 是兩個請求：在兩者都確認前保留載入狀態，
  // 避免右上角依序出現「訪客 -> 預設頭像 -> 真實頭像」的跳動。
  const [isIdentityLoading, setIsIdentityLoading] = useState(true);
  
  // 交互状态保留
  const [immersiveVideo, setImmersiveVideo] = useState(null);
  const [detailPageVideo, setDetailPageVideo] = useState(null);
  const warmedUpIdentityRef = useRef('');
  const feedSentinelRef = useRef(null);
  const feedRequestRef = useRef(false);
  const swipeStartRef = useRef(null);
  const sectionScrollRef = useRef({ following: 0, latest: 0, modules: 0 });
  const myProfilePath = userProfile?.username ? `/u/${userProfile.username}` : '/u/me';

  // 初始化加载数据
  useEffect(() => {
    let isActive = true;

    async function loadInitialFeed() {
      feedRequestRef.current = true;

      try {
        // 即使已有記憶體快取，也在背景刷新第一批；畫面保留舊內容，不重新閃骨架。
        const data = await fetchFeedPage(0);
        if (!isActive) return;

        const firstPageItems = data.items || [];
        const cachedFeed = initialFeedRef.current;
        const nextItems = cachedFeed?.items?.length
          ? mergeFeedItems(firstPageItems, cachedFeed.items)
          : firstPageItems;
        const resolvedOffset = cachedFeed?.items?.length
          ? Math.max(cachedFeed.nextOffset || 0, data.next_offset || firstPageItems.length)
          : (data.next_offset || firstPageItems.length);
        const resolvedHasMore = cachedFeed?.items?.length
          ? Boolean(cachedFeed.hasMore || data.has_more)
          : Boolean(data.has_more);

        setVideos(nextItems);
        setNextFeedOffset(resolvedOffset);
        setHasMoreFeed(resolvedHasMore);
        cacheHomeFeed(nextItems, { hasMore: resolvedHasMore, nextOffset: resolvedOffset });

        const nextLikedPostIds = await loadLikedPostIds(nextItems.map((item) => item.post_id));
        if (isActive && nextLikedPostIds) {
          setLikedPostIds(nextLikedPostIds);
        }
      } catch (error) {
        console.error('讀取最新策展失敗:', error);
      } finally {
        feedRequestRef.current = false;
        if (isActive) setLoading(false);
      }
    }

    loadInitialFeed();

    async function loadIdentity() {
      try {
        // 先確認登入身份；未登入時不需要再請求 profiles。
        const { data: { user } } = await supabase.auth.getUser();
        if (!isActive) return;

        setCurrentUser(user || null);

        if (!user) return;

        loadUnreadNotificationCount()
          .then((count) => {
            if (isActive) setUnreadNotificationCount(count);
          })
          .catch((error) => console.warn('讀取未讀通知失敗:', error));

        // 頭像與 username 都準備好後才結束載入，避免預設圖短暫閃過。
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, bio, aesthetic_tags, role')
          .eq('id', user.id)
          .single();

        if (!isActive) return;

        if (error) {
          console.error('讀取個人資料失敗:', error);
        } else {
          setUserProfile(data || null);
          if (data?.username) {
            cacheProfileRoute(user.id, data.username);
          }
          prefetchProfilePage(data).catch((prefetchError) => {
            console.warn('預先載入個人頁失敗:', prefetchError);
          });
        }
      } catch (error) {
        // 即使身份確認失敗也結束骨架狀態，讓使用者仍可看到登入入口。
        console.error('讀取登入身份失敗:', error);
      } finally {
        if (isActive) setIsIdentityLoading(false);
      }
    }

    loadIdentity();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;

    async function warmHomeSections() {
      const [followingResult, modulesResult] = await Promise.allSettled([
        prefetchFollowingFeed({ force: true }),
        prefetchModules({ force: true }),
      ]);

      if (!isActive) return;

      if (followingResult.status === 'fulfilled') {
        const feed = followingResult.value;
        const nextFollowingVideos = normalizeFollowingPosts(feed);
        setFollowingVideos(nextFollowingVideos);
        setFollowingRequiresLogin(Boolean(feed?.requiresLogin));

        if (nextFollowingVideos.length > 0) {
          try {
            const nextLikedPostIds = await loadLikedPostIds(nextFollowingVideos.map((item) => item.post_id));
            if (isActive && nextLikedPostIds) {
              setLikedPostIds((currentIds) => new Set([...currentIds, ...nextLikedPostIds]));
            }
          } catch (error) {
            console.warn('追蹤動態喜歡狀態預載失敗:', error);
          }
        }
      } else {
        console.warn('追蹤動態預載失敗:', followingResult.reason);
      }

      if (modulesResult.status === 'fulfilled') {
        setModules(modulesResult.value || []);
      } else {
        console.warn('頻道列表預載失敗:', modulesResult.reason);
      }

      setFollowingLoading(false);
      setModulesLoading(false);
    }

    warmHomeSections();
    return () => { isActive = false; };
  }, []);

  const loadMoreFeed = useCallback(async () => {
    if (!hasMoreFeed || feedRequestRef.current) return;

    feedRequestRef.current = true;
    setLoadingMoreFeed(true);

    try {
      const data = await fetchFeedPage(nextFeedOffset);
      const nextPageItems = data.items || [];
      const resolvedOffset = data.next_offset ?? (nextFeedOffset + nextPageItems.length);
      const resolvedHasMore = Boolean(data.has_more);

      setVideos((currentItems) => {
        const mergedItems = mergeFeedItems(currentItems, nextPageItems);
        cacheHomeFeed(mergedItems, { hasMore: resolvedHasMore, nextOffset: resolvedOffset });
        return mergedItems;
      });
      setNextFeedOffset(resolvedOffset);
      setHasMoreFeed(resolvedHasMore);

      // 下一批資料出現前先預取最靠前幾張詳情頁程式碼，點擊時不再臨時等待。
      nextPageItems.slice(0, 4).forEach((item) => {
        if (item.post_id) router.prefetch(`/p/${item.post_id}`).catch(() => {});
      });

      const nextLikedPostIds = await loadLikedPostIds(nextPageItems.map((item) => item.post_id));
      if (nextLikedPostIds) {
        setLikedPostIds((currentIds) => new Set([...currentIds, ...nextLikedPostIds]));
      }
    } catch (error) {
      console.error('預先載入下一批策展失敗:', error);
    } finally {
      feedRequestRef.current = false;
      setLoadingMoreFeed(false);
    }
  }, [hasMoreFeed, nextFeedOffset, router]);

  useEffect(() => {
    if (activeSection !== 'latest' || loading || !hasMoreFeed || typeof window === 'undefined' || !feedSentinelRef.current) return undefined;

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const preloadDistance = connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)
      ? '180px 0px'
      : '900px 0px';
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMoreFeed();
    }, { rootMargin: preloadDistance });

    observer.observe(feedSentinelRef.current);
    return () => observer.disconnect();
  }, [activeSection, hasMoreFeed, loadMoreFeed, loading]);

  useEffect(() => {
    if (loading || typeof window === 'undefined') return;

    const savedScrollY = window.sessionStorage.getItem('shenmei:home-scroll-y');
    if (!savedScrollY) return;

    // 等首頁資料完成渲染後再回到原位置，避免卡片尚未出現時捲動失效。
    window.sessionStorage.removeItem('shenmei:home-scroll-y');
    window.requestAnimationFrame(() => {
      window.scrollTo(0, Number(savedScrollY));
    });
  }, [loading]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const updateBackToTopVisibility = () => {
      const revealDistance = Math.max(window.innerHeight * 1.25, 720);
      setShowBackToTop(window.scrollY >= revealDistance);
    };

    updateBackToTopVisibility();
    window.addEventListener('scroll', updateBackToTopVisibility, { passive: true });
    window.addEventListener('resize', updateBackToTopVisibility);

    return () => {
      window.removeEventListener('scroll', updateBackToTopVisibility);
      window.removeEventListener('resize', updateBackToTopVisibility);
    };
  }, []);

  useEffect(() => {
    videos.slice(0, 8).forEach((video) => {
      if (video.post_id) {
        router.prefetch(`/p/${video.post_id}`);
      }
    });
  }, [router, videos]);

  useEffect(() => {
    if (loading || isIdentityLoading || typeof window === 'undefined') return undefined;

    // 弱網與省流模式優先保住首頁本身，不在背景額外取用頁面資源。
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType)) return undefined;

    const identityKey = currentUser?.id || 'guest';
    if (warmedUpIdentityRef.current === identityKey) return undefined;
    warmedUpIdentityRef.current = identityKey;

    const warmUpCorePages = () => {
      if (document.visibilityState !== 'visible') return;

      // 只預熱高頻入口的程式碼；資料仍維持既有的快取與權限判斷。
      ['/m', '/search', '/submit'].forEach((path) => {
        router.prefetch(path).catch(() => {});
      });
      prefetchModules().catch(() => {});

      if (!currentUser) return;

      router.prefetch('/messages').catch(() => {});
      router.prefetch('/notifications').catch(() => {});
      prefetchMessageInbox().catch(() => {});

      if (userProfile?.username) {
        router.prefetch(`/u/${userProfile.username}`).catch(() => {});
      }
    };

    // 把工作让给浏览器的空闲时段，避免首页刚打开就出现抢资源的卡顿。
    if ('requestIdleCallback' in window) {
      const idleCallbackId = window.requestIdleCallback(warmUpCorePages, { timeout: 2000 });
      return () => window.cancelIdleCallback(idleCallbackId);
    }

    const timeoutId = window.setTimeout(warmUpCorePages, 800);
    return () => window.clearTimeout(timeoutId);
  }, [currentUser, isIdentityLoading, loading, router, userProfile?.username]);

  // 历史记录劫持：防侧滑退出魔法
  useEffect(() => {
    const handlePopState = () => {
      if (immersiveVideo) setImmersiveVideo(null);
      if (detailPageVideo) setDetailPageVideo(null);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [immersiveVideo, detailPageVideo]);

  // 鎖定背景滾動
  useEffect(() => {
    if (detailPageVideo) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [detailPageVideo]);

  const openImmersive = (video) => {
    window.history.pushState({ modal: true }, "");
    setImmersiveVideo(video);
  };

  const closeImmersive = () => {
    setImmersiveVideo(null);
    if (window.history.state && window.history.state.modal) {
      window.history.back();
    }
  };

  const openDetailPage = (video) => {
    // 有 post_id 時進入正式策展詳情頁；沒有時才退回舊的本頁浮層。
    if (video.post_id) {
      cachePostPreview(video);
      router.prefetch(`/p/${video.post_id}`);
      router.push(`/p/${video.post_id}`);
      return;
    }

    window.history.pushState({ modal: true }, "");
    setDetailPageVideo(video);
  };

  const prefetchMyProfile = () => {
    if (!userProfile) return;

    router.prefetch(myProfilePath);
    prefetchProfilePage(userProfile).catch((prefetchError) => {
      console.warn('預先載入個人頁失敗:', prefetchError);
    });
  };

  const openVideoPage = (video) => {
    // 影片主頁以 video 為核心，負責沉澱播放、所有推薦與公共留言。
    if (video.video_id || video.id) {
      router.push(`/v/${video.video_id || video.id}`);
    }
  };

  const refreshAndReturnToTop = useCallback(async () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (activeSection !== 'latest' || feedRequestRef.current) return;

    feedRequestRef.current = true;

    try {
      const data = await fetchFeedPage(0);
      const firstPageItems = data.items || [];
      const resolvedOffset = data.next_offset || firstPageItems.length;
      const resolvedHasMore = Boolean(data.has_more);

      setVideos(firstPageItems);
      setNextFeedOffset(resolvedOffset);
      setHasMoreFeed(resolvedHasMore);
      cacheHomeFeed(firstPageItems, { hasMore: resolvedHasMore, nextOffset: resolvedOffset });

      const nextLikedPostIds = await loadLikedPostIds(firstPageItems.map((item) => item.post_id));
      if (nextLikedPostIds) setLikedPostIds(nextLikedPostIds);
    } catch (error) {
      console.error('重新整理最新策展失敗:', error);
      showToast('重新整理失敗，請稍後再試。');
    } finally {
      feedRequestRef.current = false;
    }
  }, [activeSection]);

  const switchHomeSection = useCallback((nextSection, motion = 'none') => {
    if (!HOME_SECTIONS.includes(nextSection) || nextSection === activeSection) return;

    sectionScrollRef.current[activeSection] = window.scrollY;
    setSectionMotion(motion);
    setActiveSection(nextSection);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: sectionScrollRef.current[nextSection] || 0, behavior: 'auto' });
      });
    });
  }, [activeSection]);

  const handleSectionTouchStart = (event) => {
    const touch = event.touches[0];
    swipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  };

  const handleSectionTouchEnd = (event) => {
    const start = swipeStartRef.current;
    const touch = event.changedTouches[0];
    swipeStartRef.current = null;
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return;

    const currentIndex = HOME_SECTIONS.indexOf(activeSection);
    const nextIndex = deltaX < 0 ? currentIndex + 1 : currentIndex - 1;
    const nextSection = HOME_SECTIONS[nextIndex];
    if (nextSection) switchHomeSection(nextSection, deltaX < 0 ? 'left' : 'right');
  };

  const openUserPage = (event, video) => {
    event.stopPropagation();

    if (video.profile_username) {
      router.push(`/u/${video.profile_username}`);
      return;
    }

    openDetailPage(video);
  };

  const goToProtectedPage = async (path, message) => {
    try {
      const user = await requireLogin({
        router,
        nextPath: path,
        message,
      });

      if (user) {
        router.push(path);
      }
    } catch (error) {
      console.error('登入狀態檢查失敗:', error);
      showToast('登入狀態確認失敗，請稍後再試。');
    }
  };

  const handleToggleLike = async (event, video) => {
    event.stopPropagation();

    if (!video.post_id || likingPostIds.has(video.post_id)) {
      return;
    }

    setLikingPostIds((currentIds) => new Set(currentIds).add(video.post_id));

    try {
      const result = await togglePostLike(video.post_id);

      if (result.requiresLogin) {
        await requireLogin({
          router,
          nextPath: router.asPath,
          message: '請先登入，才能喜歡這條策展。',
        });
        return;
      }

      setLikedPostIds((currentIds) => {
        const nextIds = new Set(currentIds);

        if (result.liked) {
          nextIds.add(video.post_id);
        } else {
          nextIds.delete(video.post_id);
        }

        return nextIds;
      });

      setVideos((currentItems) => {
        const nextItems = currentItems.map((item) => (
          item.post_id === video.post_id
            ? { ...item, play_count: Math.max(0, (item.play_count || 0) + result.delta) }
            : item
        ));

        cacheHomeFeed(nextItems, { hasMore: hasMoreFeed, nextOffset: nextFeedOffset });
        return nextItems;
      });
      setFollowingVideos((currentItems) => currentItems.map((item) => (
        item.post_id === video.post_id
          ? { ...item, play_count: Math.max(0, (item.play_count || 0) + result.delta) }
          : item
      )));
    } catch (error) {
      console.error('切換喜歡狀態失敗:', error);
      showToast('喜歡操作失敗，請稍後再試。');
    } finally {
      setLikingPostIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.delete(video.post_id);
        return nextIds;
      });
    }
  };

  const closeDetailPage = () => {
    setDetailPageVideo(null);
    if (window.history.state && window.history.state.modal) {
      window.history.back();
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp.toString().length === 10 ? timestamp * 1000 : timestamp);
    const minsAgo = Math.floor((new Date() - date) / 60000);
    if (minsAgo < 60) return `${minsAgo} 分鐘前`;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const visibleVideos = activeSection === 'following' ? followingVideos : videos;
  const activeFeedLoading = activeSection === 'following' ? followingLoading : loading;

  return (
    // 主背景：略帶冷灰的基礎色
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingBottom: '100px', position: 'relative' }}>
      <Head>
        <title>採樣器</title>
      </Head>

      {/* 顶部导航栏 */}
      <header style={{
        boxSizing: 'border-box', left: 0, position: 'fixed', right: 0, top: 0, width: '100%', zIndex: 20,
        backgroundColor: 'var(--bg-surface)',
        padding: '48px 16px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end',
        borderBottom: '1px solid var(--border-light)'
      }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
          <button
            type="button"
            onClick={() => switchHomeSection('following', 'left')}
            style={{ background: 'transparent', border: 'none', color: activeSection === 'following' ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: activeSection === 'following' ? '20px' : '18px', fontWeight: activeSection === 'following' ? 600 : 500, padding: 0 }}
          >
            追蹤
          </button>
          <button
            type="button"
            onClick={() => switchHomeSection('latest', activeSection === 'following' ? 'right' : 'left')}
            style={{ background: 'transparent', border: 'none', color: activeSection === 'latest' ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: activeSection === 'latest' ? '20px' : '18px', fontWeight: activeSection === 'latest' ? 600 : 500, padding: 0 }}
          >
            推薦
          </button>
          <button
            type="button"
            onClick={() => switchHomeSection('modules', 'right')}
            style={{ background: 'transparent', border: 'none', color: activeSection === 'modules' ? 'var(--text-primary)' : 'var(--text-tertiary)', cursor: 'pointer', fontSize: activeSection === 'modules' ? '20px' : '18px', fontWeight: activeSection === 'modules' ? 600 : 500, padding: 0 }}
          >
            頻道
          </button>
        </div>
        <div style={{ display: 'flex', gap: '16px', paddingBottom: '2px', alignItems: 'center' }}>
          <svg onClick={() => router.push('/search')} style={{ width: '22px', height: '22px', color: 'var(--text-primary)', cursor: 'pointer' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>

          {isIdentityLoading ? (
            <div
              aria-label="正在載入帳號"
              style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'var(--border-light)' }}
            />
          ) : currentUser ? (
            <div 
              onMouseEnter={prefetchMyProfile}
              onTouchStart={prefetchMyProfile}
              onClick={() => router.push(myProfilePath)}
              style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-light)', overflow: 'hidden', cursor: 'pointer' }}
            >
              <img src={userProfile?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${userProfile?.username || currentUser.id}`} alt="您的頭像" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          ) : (
            <div 
              onClick={() => router.push('/login')} 
              style={{ padding: '4px 12px', borderRadius: '6px', border: '1px solid var(--border-light)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', backgroundColor: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              登入
            </div>
          )}
        </div>
      </header>

      {/* 帖子信息流 */}
      <main
        onTouchEnd={handleSectionTouchEnd}
        onTouchStart={handleSectionTouchStart}
        style={{ maxWidth: '600px', margin: '0 auto', minHeight: 'calc(100vh - 164px)', padding: '90px 0 0', touchAction: 'pan-y' }}
      >
        <div
          key={`${activeSection}-${sectionMotion}`}
          className={sectionMotion === 'none' ? '' : `home-section-enter home-section-enter--${sectionMotion}`}
        >
        {activeSection === 'modules' ? (
          <section style={{ padding: '18px 14px 24px' }}>
            {modulesLoading ? (
              <div aria-label="正在載入頻道" style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="app-detail-skeleton" style={{ aspectRatio: '4 / 3', borderRadius: '8px' }} />
                ))}
              </div>
            ) : modules.length === 0 ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.8, padding: '72px 20px', textAlign: 'center' }}>
                目前還沒有開放中的頻道。
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px', gridTemplateColumns: '1fr 1fr' }}>
                {modules.map((module) => {
                  const hasImage = Boolean(module.cover_url || module.latest_cover_url);

                  return (
                    <button
                      key={module.id}
                      type="button"
                      onClick={() => router.push(`/m/${module.slug}`)}
                      onMouseEnter={() => prefetchModulePage(module.slug).catch(() => {})}
                      onTouchStart={() => prefetchModulePage(module.slug).catch(() => {})}
                      style={{
                        ...getModuleCardBackground(module),
                        aspectRatio: '4 / 3',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        padding: 0,
                        position: 'relative',
                        textAlign: 'left',
                        width: '100%',
                      }}
                    >
                      <span style={{
                        background: hasImage
                          ? 'linear-gradient(to top, rgba(10,20,35,0.84) 0%, rgba(10,20,35,0.26) 58%, transparent 100%)'
                          : 'linear-gradient(to top, rgba(0,0,0,0.42) 0%, transparent 64%)',
                        bottom: 0,
                        color: '#FFFFFF',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'flex-end',
                        left: 0,
                        padding: '28px 14px 14px',
                        position: 'absolute',
                        right: 0,
                        top: 0,
                      }}>
                        <span style={{ fontSize: '15px', fontWeight: 600, lineHeight: 1.3 }}>{module.name}</span>
                        {module.description && (
                          <span style={{ color: 'rgba(255,255,255,0.76)', fontSize: '11px', lineHeight: 1.5, marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {module.description}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
        ) : activeFeedLoading ? (
          <div aria-label="正在載入最新策展" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '8px 0 18px' }}>
            {[0, 1, 2].map((index) => (
              <article
                key={index}
                style={{
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  padding: '16px 0',
                  borderBottom: '1px solid var(--border-light)'
                }}
              >
                <div style={{ alignItems: 'center', display: 'flex', gap: '10px', padding: '0 16px' }}>
                  <div className="app-detail-skeleton" style={{ borderRadius: '50%', height: '28px', width: '28px' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="app-detail-skeleton" style={{ height: '12px', width: '86px' }} />
                  </div>
                </div>

                <div style={{ margin: '0 16px', borderRadius: '8px', overflow: 'hidden' }}>
                  <div className="app-detail-skeleton" style={{ height: '220px' }} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '0 16px' }}>
                  <div className="app-detail-skeleton" style={{ height: '14px', width: '72%' }} />
                  <div className="app-detail-skeleton" style={{ height: '14px', width: '58%' }} />
                </div>

                <div style={{ display: 'flex', gap: '18px', padding: '0 16px' }}>
                  <div className="app-detail-skeleton" style={{ height: '12px', width: '32px' }} />
                  <div className="app-detail-skeleton" style={{ height: '12px', width: '32px' }} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {activeSection === 'following' && followingRequiresLogin && (
              <button
                type="button"
                onClick={() => router.push('/login?next=/')}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px', lineHeight: 1.8, padding: '88px 20px', textAlign: 'center' }}
              >
                登入後，這裡會留下您追蹤之人的最新採樣。
              </button>
            )}

            {activeSection === 'following' && !followingRequiresLogin && visibleVideos.length === 0 && (
              <div style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.8, padding: '88px 20px', textAlign: 'center' }}>
                還沒有追蹤動態。遇見喜歡的策展人後，這裡就會慢慢流動起來。
              </div>
            )}

            {visibleVideos.map((video, index) => (
              // 帖子卡片
              <article key={video.post_id || video.id || video.bvid} onMouseEnter={() => video.post_id && router.prefetch(`/p/${video.post_id}`)} style={{ backgroundColor: 'var(--bg-surface)', padding: '16px 0', borderBottom: '1px solid var(--border-light)' }}>
                
                {/* 头部：用户信息区 */}
                <div onClick={() => openDetailPage(video)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', padding: '0 16px', cursor: 'pointer' }}>
                  <div onClick={(event) => openUserPage(event, video)} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--bg-base)',
                      backgroundImage: video.profile_avatar_url ? `url(${video.profile_avatar_url})` : 'none',
                      backgroundPosition: 'center',
                      backgroundSize: 'cover',
                      overflow: 'hidden',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary)',
                      fontWeight: '500',
                      fontSize: '12px',
                      border: '1px solid var(--border-light)'
                    }}>
                       {video.profile_avatar_url ? '' : (video.added_by ? video.added_by.charAt(0) : '審')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px' }}>{video.added_by || '策展人'}</span>
                      <AestheteBadge role={video.profile_role} />

                      <span style={{ color: 'var(--text-tertiary)', fontSize: '12px', fontWeight: '400' }}>· {formatDate(video.fav_time || video.created_at)}</span>
                    </div>
                  </div>
                  <svg style={{ width: '18px', height: '18px', color: 'var(--text-tertiary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"></path></svg>
                </div>

                {/* 文字内容区 (折叠为3行) */}
                <div onClick={() => openDetailPage(video)} style={{ padding: '0 16px', marginBottom: '12px', cursor: 'pointer' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '15px', lineHeight: '1.6', margin: 0, wordBreak: 'break-word', letterSpacing: '0.2px', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {video.title}
                  </p>
                </div>

                {/* 媒体区域 (带 16px 边距与圆角) */}
                <div onClick={() => openImmersive(video)} style={{ position: 'relative', margin: '0 16px 12px', borderRadius: '8px', paddingTop: '42.8%', backgroundColor: 'var(--bg-base)', overflow: 'hidden', cursor: 'pointer', border: '1px solid var(--border-light)' }}>
                  <img
                    src={video.cover}
                    alt={video.title}
                    referrerPolicy="no-referrer"
                    loading={index < 2 ? 'eager' : 'lazy'}
                    fetchPriority={index === 0 ? 'high' : 'auto'}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* 悬浮播放icon */}
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '42px', height: '42px', backgroundColor: 'rgba(255, 255, 255, 0.75)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                    <div style={{ width: 0, height: 0, borderTop: '7px solid transparent', borderBottom: '7px solid transparent', borderLeft: '10px solid var(--text-primary)', marginLeft: '3px' }}></div>
                  </div>
                </div>

                {/* 美学标签 (原视频标题) 与互动图标在一行 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px' }}>
                  {video.video_title ? (
                    <div onClick={() => openVideoPage(video)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: 'var(--brand-blue-light)', color: 'var(--brand-blue)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '500', cursor: 'pointer', maxWidth: '60%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                      <svg style={{ width: '12px', height: '12px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{video.video_title}</span>
                    </div>
                  ) : (
                    <div />
                  )}

                  {/* 右侧底部互动区 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)' }}>
                    <div onClick={() => openDetailPage(video)} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                      <span style={{ fontSize: '12px', fontWeight: '400' }}>{video.comment_count || 0}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => handleToggleLike(event, video)}
                      disabled={likingPostIds.has(video.post_id)}
                      style={{
                        alignItems: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: likedPostIds.has(video.post_id) ? '#FF4D4F' : 'var(--text-secondary)',
                        cursor: likingPostIds.has(video.post_id) ? 'wait' : 'pointer',
                        display: 'flex',
                        gap: '4px',
                        padding: 0,
                      }}
                    >
                      <svg style={{ width: '18px', height: '18px' }} fill={likedPostIds.has(video.post_id) ? 'currentColor' : 'none'} stroke={likedPostIds.has(video.post_id) ? '#FF4D4F' : 'currentColor'} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                      <span style={{ fontSize: '12px', fontWeight: '400' }}>{video.play_count || 0}</span>
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {activeSection === 'latest' && loadingMoreFeed && (
              <article aria-label="正在預先載入更多策展" style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)', padding: '16px' }}>
                <div style={{ alignItems: 'center', display: 'flex', gap: '10px' }}>
                  <div className="app-detail-skeleton" style={{ borderRadius: '50%', height: '28px', width: '28px' }} />
                  <div className="app-detail-skeleton" style={{ height: '12px', width: '92px' }} />
                </div>
                <div className="app-detail-skeleton" style={{ borderRadius: '8px', height: '190px', marginTop: '14px' }} />
              </article>
            )}

            {activeSection === 'latest' && <div ref={feedSentinelRef} aria-hidden="true" style={{ height: '1px' }} />}

            {activeSection === 'latest' && !hasMoreFeed && videos.length > 0 && (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', padding: '18px 16px 6px', textAlign: 'center' }}>
                暫時看到這裡
              </div>
            )}
          </div>
        )}
        </div>
      </main>

      {/* 重新整理與回到頂部按鈕 */}
      {activeSection === 'latest' && (
        <button
          type="button"
          aria-label="重新整理推薦並回到頂部"
          title="重新整理推薦並回到頂部"
          onClick={refreshAndReturnToTop}
          style={{ position: 'fixed', bottom: '148px', right: '16px', width: '42px', height: '42px', padding: 0, backgroundColor: 'var(--bg-surface)', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', zIndex: 30, cursor: 'pointer' }}
        >
          <svg aria-hidden="true" style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 3v5h-5" />
          </svg>
        </button>
      )}

      {/* 懸浮通知入口 */}
      <div onClick={() => goToProtectedPage('/notifications', '請先登入，才能查看通知。')} style={{ position: 'fixed', bottom: '96px', right: '16px', width: '42px', height: '42px', backgroundColor: 'var(--bg-surface)', borderRadius: '50%', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)', border: '1px solid var(--border-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', zIndex: 30, cursor: 'pointer' }}>
        <svg style={{ width: '20px', height: '20px' }} fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"></path><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"></path></svg>
        {unreadNotificationCount > 0 && (
          <span style={{ position: 'absolute', top: 0, right: 0, minWidth: '12px', height: '12px', backgroundColor: '#FF4D4F', borderRadius: '999px', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 600, padding: unreadNotificationCount > 9 ? '0 4px' : '0' }}>
            {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount}
          </span>
        )}
      </div>

      <AppBottomNav
        active={activeSection === 'modules' ? 'modules' : 'home'}
        onHomeSelect={() => switchHomeSection('latest', activeSection === 'modules' ? 'left' : 'right')}
        onModulesSelect={() => switchHomeSection('modules', 'right')}
      />

      <ImmersiveVideoPlayer video={immersiveVideo} onClose={closeImmersive} />

      {/* 浮层 2：文字单页详情式 */}
      {detailPageVideo && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'var(--bg-surface)', zIndex: 999, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px', backgroundColor: 'var(--bg-surface)', position: 'sticky', top: 0, borderBottom: '1px solid var(--border-light)' }}>
            <div onClick={closeDetailPage} style={{ padding: '8px', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: '500' }}>← 返回</div>
            <div style={{ flex: 1, textAlign: 'center', fontWeight: '600', color: 'var(--text-primary)', paddingRight: '40px' }}>動態詳情</div>
          </div>
          <div style={{ paddingBottom: '100px' }}>
            <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', backgroundColor: '#000', borderBottom: '1px solid var(--border-light)' }}>
              <iframe src={`//player.bilibili.com/player.html?bvid=${detailPageVideo.bvid}&page=1&autoplay=1&high_quality=1&loop=1`} scrolling="no" border="0" frameBorder="no" framespacing="0" allowFullScreen={true} allow="autoplay; fullscreen" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}></iframe>
            </div>
            <div style={{ padding: '0 20px' }}>
              <h2 style={{ fontSize: '16px', marginTop: '20px', color: 'var(--text-primary)', lineHeight: '1.6', fontWeight: '600' }}>{detailPageVideo.title}</h2>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>@{detailPageVideo.up_name}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-tertiary)' }}>{detailPageVideo.play_count} 次觀看</span>
              </div>
              <div style={{ marginTop: '40px', padding: '30px 20px', textAlign: 'center', color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-base)', borderRadius: '8px' }}>
                這裡之後可以放評論區或更多推薦
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
