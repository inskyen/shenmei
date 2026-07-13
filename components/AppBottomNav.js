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

export default function AppBottomNav({ active }) {
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
    const channel = supabase
      .channel('bottom-nav-unread-messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const message = payload.new || payload.old;
        if (currentUserId && (message?.receiver_id === currentUserId || message?.sender_id === currentUserId)) {
          refreshUnreadMessages();
        }
      })
      .subscribe();

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
      message: '請先登入，才能進入你的策展人頁。',
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
    router.prefetch('/m');
    prefetchModules().catch((error) => console.error('小館列表預取失敗:', error));
    router.push('/m');
  };

  const goToMessages = () => {
    router.prefetch('/messages');
    prefetchMessageInbox().catch((error) => console.error('私訊列表預取失敗:', error));
    goToProtectedPage('/messages', '請先登入，才能查看訊息。');
  };

  const goToHome = () => {
    router.prefetch('/');
    // 預取關注動態，讓用戶回首頁後快速切換
    prefetchFollowingFeed().catch(() => {});
    router.push('/');
  };

  const itemStyle = (name) => ({
    alignItems: 'center',
    color: active === name ? activeColor : inactiveColor,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    flex: 1,
    height: '100%',
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
      height: '64px', 
      left: 0, 
      maxWidth: 'none', 
      padding: '4px 8px 16px', 
      position: 'fixed', 
      touchAction: 'manipulation',
      userSelect: 'none',
      WebkitTouchCallout: 'none',
      WebkitUserSelect: 'none',
      width: '100%', 
      zIndex: 100 
    }}>
      <div onClick={goToHome} style={itemStyle('home')}>
        <svg style={{ height: '22px', marginBottom: '3px', width: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z" /></svg>
        <span style={{ fontSize: '10px', fontWeight: active === 'home' ? '600' : '400' }}>發現</span>
      </div>
      <div onClick={goToModules} style={itemStyle('modules')}>
        <svg style={{ height: '22px', marginBottom: '3px', width: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M4 5.5A1.5 1.5 0 015.5 4H10v7H4V5.5zM14 4h4.5A1.5 1.5 0 0120 5.5V11h-6V4zM4 15h6v5H5.5A1.5 1.5 0 014 18.5V15zM14 15h6v3.5a1.5 1.5 0 01-1.5 1.5H14v-5z" /></svg>
        <span style={{ fontSize: '10px', fontWeight: active === 'modules' ? '600' : '400' }}>小館</span>
      </div>
      <div onClick={() => goToProtectedPage('/submit', '請先登入，才能採樣。')} style={itemStyle('submit')}>
        <div style={{ 
          alignItems: 'center', 
          backgroundColor: 'var(--brand-blue)', 
          borderRadius: '6px', 
          color: '#FFFFFF', 
          display: 'flex', 
          height: '26px', 
          width: '38px',
          justifyContent: 'center',
          marginBottom: '3px'
        }}>
          <svg style={{ height: '16px', width: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" /></svg>
        </div>
        <span style={{ fontSize: '10px', fontWeight: active === 'submit' ? '600' : '400' }}>採樣</span>
      </div>
      <div onClick={goToMessages} style={itemStyle('messages')}>
        <span style={{ display: 'inline-flex', marginBottom: '3px', position: 'relative' }}>
          <svg style={{ height: '22px', width: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
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
        <span style={{ fontSize: '10px', fontWeight: active === 'messages' ? '600' : '400' }}>私訊</span>
      </div>
      <div onClick={goToMyProfile} style={itemStyle('profile')}>
        <svg style={{ height: '22px', marginBottom: '3px', width: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        <span style={{ fontSize: '10px', fontWeight: active === 'profile' ? '600' : '400' }}>我的</span>
      </div>
    </nav>
  );
}
