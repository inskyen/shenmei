import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DirectMessageThread from '@/components/DirectMessageThread';
import { requireLogin } from '@/lib/auth/requireLogin';
import { loadMessageTarget, sendDirectMessage } from '@/lib/messages/directMessages';

export default function NewMessagePage() {
  const router = useRouter();
  const username = typeof router.query.user === 'string' ? router.query.user : '';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!username) return;

    async function loadTarget() {
      try {
        const user = await requireLogin({ router, nextPath: `/messages/new?user=${username}`, message: '請先登入，才能傳送私訊。', replace: true });
        if (!user) return;
        const result = await loadMessageTarget(username);
        if (!result.profile) throw new Error('找不到這位審美者。');
        if (result.profile.id === user.id) throw new Error('不能向自己傳送私訊。');
        setData(result);
      } catch (error) {
        setErrorMessage(error.message || '無法開始這段私訊。');
      } finally {
        setLoading(false);
      }
    }

    loadTarget();
  }, [router, username]);

  const handleSend = async (content) => {
    if (!data?.profile) return;
    setSending(true);
    setErrorMessage('');
    try {
      const conversationId = await sendDirectMessage(data.profile.id, content);
      router.replace(`/messages/${conversationId}`);
    } catch (error) {
      setErrorMessage(error.message || '訊息傳送失敗，請稍後再試。');
    } finally {
      setSending(false);
    }
  };

  const name = data?.profile?.display_name || data?.profile?.username || '私訊';
  const disabledMessage = data?.profile?.message_permission === 'none' ? '對方目前不接收新的私訊。' : '';

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: '100vh' }}>
      <Head><title>私訊 · 審美者</title></Head>
      <header style={{ alignItems: 'center', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', padding: '48px 18px 14px', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', fontWeight: 500, padding: 0 }}>← 返回</button>
        <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>私訊 {name}</div>
        <span style={{ width: '32px' }} />
      </header>
      <main style={{ margin: '0 auto', maxWidth: '680px', padding: '18px 16px 28px' }}>
        {loading && <div style={{ color: 'var(--text-tertiary)', padding: '48px 0', textAlign: 'center' }}>正在準備私訊...</div>}
        {!loading && errorMessage && <p style={{ color: '#FF4D4F', lineHeight: 1.7 }}>{errorMessage}</p>}
        {!loading && data && <DirectMessageThread currentUserId={data.currentUser.id} messages={[]} onSend={handleSend} sending={sending} disabledMessage={disabledMessage} />}
      </main>
    </div>
  );
}
