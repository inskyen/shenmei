import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AppBottomNav from '@/components/AppBottomNav';
import { requireLogin } from '@/lib/auth/requireLogin';
import { loadNotifications, markNotificationsRead } from '@/lib/notifications/userNotifications';

const notificationCopy = {
  like: '喜歡了您的採樣。',
  comment: '在您的採樣下留言。',
  reply: '回覆了您的留言。',
  follow: '關注了您。',
  message: '傳來了一則私訊。',
};

function formatRelativeTime(timestamp) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return '剛剛';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分鐘前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小時前`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} 天前`;

  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function getActorName(notification) {
  return notification.actor?.display_name || notification.actor?.username || '一位審美者';
}

function getInitial(notification) {
  return getActorName(notification).charAt(0).toUpperCase();
}

const CACHE_KEY = 'shenmei:notifications-cache';

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(notifications) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(notifications));
  } catch {
    // sessionStorage 寫入失敗時靜默忽略，不影響功能。
  }
}

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(() => readCache() || []);
  const [loading, setLoading] = useState(() => !readCache());
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadNotificationPage() {
      setErrorMessage('');

      try {
        const user = await requireLogin({
          router,
          nextPath: '/notifications',
          message: '請先登入，才能查看通知。',
          replace: true,
        });

        if (!user) return;

        const result = await loadNotifications();
        const fresh = (result.notifications || []).filter((n) => n.type !== 'message');

        writeCache(fresh);
        setNotifications(fresh);
        await markNotificationsRead();
      } catch (error) {
        console.error('通知頁載入失敗:', error);
        // 有快取時靜默失敗，無快取時才顯示錯誤提示。
        if (!readCache()) {
          setErrorMessage('通知暫時無法顯示，請稍後再試。');
        }
      } finally {
        setLoading(false);
      }
    }

    loadNotificationPage();
  }, [router]);

  const openNotification = (notification) => {
    if (notification.conversation_id) {
      router.push(`/messages/${notification.conversation_id}`);
      return;
    }

    if (notification.post_id) {
      router.push(`/p/${notification.post_id}`);
      return;
    }

    if (notification.actor?.username) {
      router.push(`/u/${notification.actor.username}`);
    }
  };

  return (
    <>
      <Head>
        <title>通知 · 審美者</title>
      </Head>

      <div style={{
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: '100vh',
        paddingBottom: '80px',
      }}>
        {/* 固定頂部欄 */}
        <header style={{
          alignItems: 'center',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-light)',
          boxSizing: 'border-box',
          display: 'flex',
          height: '88px',
          justifyContent: 'center',
          padding: '48px 18px 14px',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}>
          <span style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: 600, letterSpacing: '0.5px' }}>
            通知
          </span>
        </header>

        <main style={{ maxWidth: '600px', margin: '0 auto', backgroundColor: 'var(--bg-surface)', minHeight: 'calc(100vh - 88px)' }}>
          {loading && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[1, 2, 3, 4].map((item) => (
                <div key={item} style={{ display: 'flex', gap: '16px', padding: '16px 20px', borderBottom: '1px solid var(--border-light)' }}>
                  <div className="app-detail-skeleton" style={{ borderRadius: '50%', height: '48px', width: '48px', flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
                    <div className="app-detail-skeleton" style={{ borderRadius: '4px', height: '16px', width: '40%' }} />
                    <div className="app-detail-skeleton" style={{ borderRadius: '4px', height: '14px', width: '25%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && errorMessage && (
            <p style={{ color: '#FF4D4F', lineHeight: 1.7, margin: 0, padding: '30px 20px', textAlign: 'center' }}>{errorMessage}</p>
          )}

          {!loading && !errorMessage && notifications.length === 0 && (
            <div style={{ color: 'var(--text-tertiary)', lineHeight: 1.8, padding: '60px 20px', textAlign: 'center' }}>
              還沒有新的光點。有人喜歡、留言或關注您時，會出現在這裡。
            </div>
          )}

          {!loading && !errorMessage && notifications.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => openNotification(notification)}
                  style={{
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border-light)',
                    cursor: notification.post_id || notification.conversation_id || notification.actor?.username ? 'pointer' : 'default',
                    display: 'flex',
                    gap: '16px',
                    padding: '16px 20px',
                    textAlign: 'left',
                    width: '100%',
                    position: 'relative'
                  }}
                >
                  <span
                    style={{
                      alignItems: 'center',
                      backgroundColor: 'var(--bg-base)',
                      backgroundImage: notification.actor?.avatar_url ? `url("${notification.actor.avatar_url}")` : 'none',
                      backgroundPosition: 'center',
                      backgroundSize: 'cover',
                      borderRadius: '50%',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      flexShrink: 0,
                      fontSize: '16px',
                      fontWeight: 500,
                      height: '48px',
                      justifyContent: 'center',
                      width: '48px',
                      border: '1px solid var(--border-light)'
                    }}
                  >
                    {!notification.actor?.avatar_url && getInitial(notification)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>{getActorName(notification)}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '15px' }}> {notificationCopy[notification.type]}</span>
                    <span style={{ color: 'var(--text-tertiary)', display: 'block', fontSize: '13px', marginTop: '4px' }}>{formatRelativeTime(notification.created_at)}</span>
                  </span>
                  {!notification.is_read && <span style={{ backgroundColor: '#FF4D4F', borderRadius: '50%', height: '8px', width: '8px', position: 'absolute', right: '20px', top: '50%', transform: 'translateY(-50%)' }} />}
                </button>
              ))}
            </div>
          )}
        </main>
      </div>
      <AppBottomNav active="notifications" />
    </>
  );
}
