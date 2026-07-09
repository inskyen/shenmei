import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PageShell, { PlaceholderNote } from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/requireLogin';

export default function NotificationsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function guardNotifications() {
      try {
        const user = await requireLogin({
          router,
          nextPath: '/notifications',
          message: '請先登入，才能查看通知。',
          replace: true,
        });

        setAllowed(Boolean(user));
      } catch (error) {
        console.error('通知頁登入檢查失敗:', error);
      } finally {
        setChecking(false);
      }
    }

    guardNotifications();
  }, [router]);

  return (
    <PageShell
      title="通知"
      subtitle="評論、回覆、喜歡與追蹤會在這裡出現。"
    >
      {checking && <PlaceholderNote>正在確認登入狀態...</PlaceholderNote>}
      {!checking && !allowed && <PlaceholderNote>請先登入，才能查看你的通知。</PlaceholderNote>}
      {!checking && allowed && (
        <PlaceholderNote>
          通知還在整理光點。之後有人喜歡、留言或回覆你時，會在這裡亮起來。
        </PlaceholderNote>
      )}
    </PageShell>
  );
}
