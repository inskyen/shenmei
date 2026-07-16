import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getCurrentUser, requireLogin } from '@/lib/auth/requireLogin';
import { getCachedProfilePath } from '@/lib/auth/profileRoute';
import { prefetchModules } from '@/lib/cache/modulePageCache';
import { prefetchMessageInbox } from '@/lib/cache/messagePageCache';
import { prefetchFollowingFeed } from '@/lib/cache/followingFeedCache';
import { supabase } from '@/lib/supabase/client';

const activeColor = 'var(--brand-blue)';
const inactiveColor = 'var(--text-secondary)';

export default function AppBottomNav({ active, onHomeSelect, onModulesSelect }) {
  const router = useRouter();
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);

  useEffect(() => {
    let isActive = true;
    let currentUserId = '';

    const refreshUnreadMessages = async () => {
      try {
        const user = await getCurrentUser();

        if (!user) {
          if (isActive) setHasUnreadMessages(false);
          return;
        }

        currentUserId = user.id;
        const { count, error } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('receiver_id', user.id)
          .is('read_at', null);

        if (error) throw error;
        if (isActive) setHasUnreadMessages((count || 0) > 0);
      } catch (error) {
        // 未讀提示失敗不應阻斷底部導航本身的使用。
        console.error('讀取私訊未讀狀態失敗:', error);
      }
    };

    refreshUnreadMessages();

    // INSERT 收到新訊息、UPDATE 標為已讀後，都重新核對一次未讀狀態。
    // 若 WebSocket 連線失敗（如被廣告攔截器或防火牆封鎖），降級為靜默 warn，
    // 不影響頁面正常運作，未讀計數仍會在頁面進入時正確載入。
    const channel = supabase
      .channel('bottom-nav-unread-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const message = payload.new || payload.old;
        if (currentUserId && (message?.receiver_id === currentUserId || message?.sender_id === currentUserId)) {
          refreshUnreadMessages();
        }
      })
      .subscribe((status, err) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] 即時連線無法建立，未讀計數將在頁面進入時載入，不影響核心功能。', err?.message || '');
        }
      });

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      refreshUnreadMessages();
    });

    return () => {
      isActive = false;
      supabase.removeChannel(channel);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const goToProtectedPage = async (path, message) => {
    const user = await requireLogin({ router, nextPath: path, message });
    if (user) router.push(path);
  };

  const goToMyProfile = async () => {
    const user = await requireLogin({
      router,
      nextPath: '/u/me',
      message: '請先登入，才能進入您的採樣人頁。',
    });

    if (!user) return;

    // 先試緩存，避免閃爍
    const cachedPath = getCachedProfilePath(user.id);
    if (cachedPath) {
      router.prefetch(cachedPath);
      router.push(cachedPath);
      return;
    }

    // 緩存沒有時，直接在這裡查 DB 拿 username，不走 /u/me 中轉
    try {
      const { supabase } = await import('@/lib/supabase/client');
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle();

      if (data?.username) {
        const { cacheProfileRoute } = await import('@/lib/auth/profileRoute');
        cacheProfileRoute(user.id, data.username);
        const directPath = `/u/${data.username}`;
        router.prefetch(directPath);
        router.push(directPath);
        return;
      }
    } catch (error) {
      console.error('取得個人主頁路徑失敗:', error);
    }

    // 最後保底才走 /u/me（理論上不會到這裡）
    router.push('/u/me');
  };

  const goToModules = () => {
    if (onModulesSelect) {
      onModulesSelect();
      return;
    }

    router.prefetch('/m');
    prefetchModules().catch((error) => console.error('頻道列表預取失敗:', error));
    router.push('/m');
  };

  const goToMessages = () => {
    router.prefetch('/messages');
    prefetchMessageInbox().catch((error) => console.error('私訊列表預取失敗:', error));
    goToProtectedPage('/messages', '請先登入，才能查看訊息。');
  };

  const goToHome = () => {
    if (onHomeSelect) {
      onHomeSelect();
      return;
    }

    router.prefetch('/');
    // 預取關注動態，讓用戶回首頁後快速切換
    prefetchFollowingFeed().catch(() => {});
    router.push('/');
  };

  const itemStyle = (name) => ({
    alignItems: 'center',
    appearance: 'none',
    background: 'transparent',
    border: 'none',
    color: active === name ? activeColor : inactiveColor,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '3px',
    flex: 1,
    height: '100%',
    minWidth: 0,
    padding: '0 0 env(safe-area-inset-bottom)',
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitTouchCallout: 'none',
    WebkitUserSelect: 'none',
  });

  return (
    <nav style={{ 
      alignItems: 'center', 
      backgroundColor: 'var(--bg-surface)', 
      borderTop: '1px solid var(--border-light)', 
      bottom: 0, 
      boxShadow: '0 -1px 3px rgba(0, 0, 0, 0.03)', 
      display: 'flex', 
      height: 'calc(64px + env(safe-area-inset-bottom))', 
      left: 0, 
      maxWidth: 'none', 
      padding: '0 8px',
      position: 'fixed', 
      touchAction: 'manipulation',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
      WebkitUserSelect: 'none',
      width: '100%', 
      zIndex: 100 
    }}>
      {/* 發現 */}
      <button type="button" onClick={goToHome} style={itemStyle('home')}>
        {active === 'home' ? (
          <svg style={{ height: '24px', width: '24px', transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)', transform: 'scale(1.05)' }} fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.596 4.95a.75.75 0 01.454.454l-2.12 6.36a.75.75 0 01-.474.474l-6.36 2.12a.75.75 0 01-.954-.954l2.12-6.36a.75.75 0 01.474-.474l6.36-2.12zM12 11a1 1 0 100 2 1 1 0 000-2z" />
          </svg>
        ) : (
          <svg style={{ height: '24px', width: '24px', transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)', transform: 'scale(1)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="1.2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
          </svg>
        )}
        <span style={{ fontSize: '10px', fontWeight: active === 'home' ? '600' : '400', lineHeight: 1 }}>發現</span>
      </button>

      {/* 頻道 */}
      <button type="button" onClick={goToModules} style={itemStyle('modules')}>
        {active === 'modules' ? (
          <svg style={{ height: '24px', width: '24px', transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)', transform: 'scale(1.05)' }} fill="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="7" height="7" rx="2" />
            <rect x="13" y="4" width="7" height="7" rx="2" />
            <rect x="4" y="13" width="7" height="7" rx="2" />
            <rect x="13" y="13" width="7" height="7" rx="2" />
          </svg>
        ) : (
          <svg style={{ height: '24px', width: '24px', transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)', transform: 'scale(1)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="4" y="4" width="7" height="7" rx="2" strokeWidth="1.2" />
            <rect x="13" y="4" width="7" height="7" rx="2" strokeWidth="1.2" />
            <rect x="4" y="13" width="7" height="7" rx="2" strokeWidth="1.2" />
            <rect x="13" y="13" width="7" height="7" rx="2" strokeWidth="1.2" />
          </svg>
        )}
        <span style={{ fontSize: '10px', fontWeight: active === 'modules' ? '600' : '400', lineHeight: 1 }}>頻道</span>
      </button>

      {/* 採樣 */}
      <button type="button" onClick={() => goToProtectedPage('/submit', '請先登入，才能採樣。')} style={itemStyle('submit')}>
        {active === 'submit' ? (
          <svg style={{ height: '28px', width: '28px', color: 'var(--text-primary)', transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)', transform: 'scale(1.05)' }} fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="var(--bg-surface)" d="M12 7.5v9M7.5 12h9" />
          </svg>
        ) : (
          <svg style={{ height: '28px', width: '28px', color: 'var(--text-primary)', transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)', transform: 'scale(1)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9.5" strokeWidth="1.2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M12 7.5v9M7.5 12h9" />
          </svg>
        )}
        <span style={{ fontSize: '10px', fontWeight: active === 'submit' ? '600' : '400', lineHeight: 1 }}>採樣</span>
      </button>

      {/* 私訊 */}
      <button type="button" onClick={goToMessages} style={itemStyle('messages')}>
        <span style={{ display: 'inline-flex', position: 'relative' }}>
          {active === 'messages' ? (
            <svg style={{ height: '24px', width: '24px', transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)', transform: 'scale(1.05)' }} fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3c-5.5 0-10 4-10 9 0 1.7.5 3.3 1.5 4.7L2 21l4.7-1.3A10.6 10.6 0 0012 21c5.5 0 10-4 10-9s-4.5-9-10-9zm-4 10.5a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm4 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm4 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
            </svg>
          ) : (
            <svg style={{ height: '24px', width: '24px', transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)', transform: 'scale(1)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          )}
          {hasUnreadMessages && (
            <span
              aria-label="有未讀私訊"
              style={{
                backgroundColor: '#FF4D4F',
                border: '2px solid var(--bg-surface)',
                borderRadius: '50%',
                height: '8px',
                position: 'absolute',
                right: '-4px',
                top: '-3px',
                width: '8px',
              }}
            />
          )}
        </span>
        <span style={{ fontSize: '10px', fontWeight: active === 'messages' ? '600' : '400', lineHeight: 1 }}>私訊</span>
      </button>

      {/* 我的 */}
      <button type="button" onClick={goToMyProfile} style={itemStyle('profile')}>
        {active === 'profile' ? (
          <svg style={{ height: '24px', width: '24px', transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)', transform: 'scale(1.05)' }} fill="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4.5" />
            <path d="M5 21a7 7 0 0114 0v1H5v-1z" />
          </svg>
        ) : (
          <svg style={{ height: '24px', width: '24px', transition: 'transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)', transform: 'scale(1)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="8" r="4" strokeWidth="1.2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.2" d="M5 21a7 7 0 0114 0" />
          </svg>
        )}
        <span style={{ fontSize: '10px', fontWeight: active === 'profile' ? '600' : '400', lineHeight: 1 }}>我的</span>
      </button>
    </nav>
  );
}
