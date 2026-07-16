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
      message: '請先登入，才能進入您的策展人頁。',
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
          <svg style={{ height: '24px', width: '24px' }} fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.596 4.95a.75.75 0 01.454.454l-2.12 6.36a.75.75 0 01-.474.474l-6.36 2.12a.75.75 0 01-.954-.954l2.12-6.36a.75.75 0 01.474-.474l6.36-2.12zM12 11a1 1 0 100 2 1 1 0 000-2z" />
          </svg>
        ) : (
          <svg style={{ height: '24px', width: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="1.5"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
          </svg>
        )}
        <span style={{ fontSize: '10px', fontWeight: active === 'home' ? '600' : '400', lineHeight: 1 }}>發現</span>
      </button>

      {/* 頻道 */}
      <button type="button" onClick={goToModules} style={itemStyle('modules')}>
        {active === 'modules' ? (
          <svg style={{ height: '24px', width: '24px' }} fill="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5"/>
          </svg>
        ) : (
          <svg style={{ height: '24px', width: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth="1.5"/>
            <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth="1.5"/>
            <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth="1.5"/>
            <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth="1.5"/>
          </svg>
        )}
        <span style={{ fontSize: '10px', fontWeight: active === 'modules' ? '600' : '400', lineHeight: 1 }}>頻道</span>
      </button>

      {/* 採樣 */}
      <button type="button" onClick={() => goToProtectedPage('/submit', '請先登入，才能採樣。')} style={itemStyle('submit')}>
        {active === 'submit' ? (
          <svg style={{ height: '32px', width: '32px', color: 'var(--text-primary)' }} fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm1 6a1 1 0 10-2 0v3H8a1 1 0 100 2h3v3a1 1 0 102 0v-3h3a1 1 0 100-2h-3V8z" />
          </svg>
        ) : (
          <svg style={{ height: '32px', width: '32px', color: 'var(--text-primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" strokeWidth="1.2"/>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8v8M8 12h8" />
          </svg>
        )}
        <span style={{ fontSize: '10px', fontWeight: active === 'submit' ? '600' : '400', lineHeight: 1 }}>採樣</span>
      </button>

      {/* 私訊 */}
      <button type="button" onClick={goToMessages} style={itemStyle('messages')}>
        <span style={{ display: 'inline-flex', position: 'relative' }}>
          {active === 'messages' ? (
            <svg style={{ height: '24px', width: '24px' }} fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 3a8.5 8.5 0 00-7.854 11.777L2.1 20.077a.75.75 0 00.955.932l5.07-1.737A8.5 8.5 0 1012 3z" />
            </svg>
          ) : (
            <svg style={{ height: '24px', width: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
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
          <svg style={{ height: '24px', width: '24px' }} fill="currentColor" viewBox="0 0 24 24">
            <path fillRule="evenodd" clipRule="evenodd" d="M12 2a5 5 0 100 10A5 5 0 0012 2zM4 20a8 8 0 1116 0H4z" />
          </svg>
        ) : (
          <svg style={{ height: '24px', width: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" strokeWidth="1.5" />
          </svg>
        )}
        <span style={{ fontSize: '10px', fontWeight: active === 'profile' ? '600' : '400', lineHeight: 1 }}>我的</span>
      </button>
    </nav>
  );
}
