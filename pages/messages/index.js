import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import PageShell, { PlaceholderNote } from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/requireLogin';

export default function MessagesPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function guardMessages() {
      try {
        const user = await requireLogin({
          router,
          nextPath: '/messages',
          message: '請先登入，才能查看訊息。',
          replace: true,
        });

        setAllowed(Boolean(user));
      } catch (error) {
        console.error('訊息頁登入檢查失敗:', error);
      } finally {
        setChecking(false);
      }
    }

    guardMessages();
  }, [router]);

  return (
    <>
      <PageShell
        title="訊息"
        subtitle="私訊會放在這裡，通知會獨立到通知頁。"
      >
        {checking && <PlaceholderNote>正在確認登入狀態...</PlaceholderNote>}
        {!checking && !allowed && <PlaceholderNote>請先登入，才能查看你的訊息。</PlaceholderNote>}
        {!checking && allowed && (
          <PlaceholderNote>
            訊息室正在安靜搭建中。未來這裡會顯示一對一私訊與未讀狀態。
          </PlaceholderNote>
        )}
      </PageShell>
      <AppBottomNav active="messages" />
    </>
  );
}
