import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import PageShell from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/requireLogin';
import { loadNotifications, markNotificationsRead } from '@/lib/notifications/userNotifications';

const notificationCopy = {
  like: '喜歡了你的策展。',
  comment: '在你的策展下留言。',
  reply: '回覆了你的留言。',
  follow: '關注了你。',
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

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadNotificationPage() {
      setLoading(true);
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
        setNotifications(result.notifications);
        await markNotificationsRead();
      } catch (error) {
        console.error('通知頁載入失敗:', error);
        setErrorMessage('通知暫時無法顯示，請稍後再試。');
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
      <PageShell
        title="通知"
        subtitle="有人回應你的審美時，光點會留在這裡。"
      >
        {loading && (
          <div style={{ display: 'grid', gap: '12px' }}>
            {[1, 2, 3].map((item) => (
              <div key={item} className="app-detail-skeleton" style={{ borderRadius: '14px', height: '72px' }} />
            ))}
          </div>
        )}

        {!loading && errorMessage && (
          <p style={{ color: '#9F5E4C', lineHeight: 1.7, margin: 0 }}>{errorMessage}</p>
        )}

        {!loading && !errorMessage && notifications.length === 0 && (
          <div style={{ color: '#87ACCA', lineHeight: 1.8, padding: '30px 8px', textAlign: 'center' }}>
            還沒有新的光點。有人喜歡、留言或關注你時，會出現在這裡。
          </div>
        )}

        {!loading && !errorMessage && notifications.length > 0 && (
          <div style={{ display: 'grid', gap: '10px' }}>
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                style={{ alignItems: 'center', backgroundColor: notification.is_read ? '#FFFFFF' : '#F3F8FC', border: '1px solid #E3ECF4', borderRadius: '14px', cursor: notification.post_id || notification.conversation_id || notification.actor?.username ? 'pointer' : 'default', display: 'flex', gap: '12px', padding: '12px', textAlign: 'left', width: '100%' }}
              >
                <span
                  style={{ alignItems: 'center', backgroundColor: '#D9E4F5', backgroundImage: notification.actor?.avatar_url ? `url("${notification.actor.avatar_url}")` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', borderRadius: '50%', color: '#6B99C3', display: 'flex', flexShrink: 0, fontSize: '17px', fontWeight: 800, height: '44px', justifyContent: 'center', width: '44px' }}
                >
                  {!notification.actor?.avatar_url && getInitial(notification)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ color: '#2A527A', fontSize: '14px', fontWeight: 700 }}>{getActorName(notification)}</span>
                  <span style={{ color: '#4A6984', fontSize: '14px' }}> {notificationCopy[notification.type]}</span>
                  <span style={{ color: '#A0B9D0', display: 'block', fontSize: '12px', marginTop: '4px' }}>{formatRelativeTime(notification.created_at)}</span>
                </span>
                {!notification.is_read && <span style={{ backgroundColor: '#F4B9AE', borderRadius: '50%', height: '8px', width: '8px' }} />}
              </button>
            ))}
          </div>
        )}
      </PageShell>
      <AppBottomNav />
    </>
  );
}
