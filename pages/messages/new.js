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
    <div style={{ backgroundColor: '#F0F4F8', color: '#2A527A', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: '100vh' }}>
      <Head><title>私訊 · 審美者</title></Head>
      <header style={{ alignItems: 'center', backdropFilter: 'blur(14px)', backgroundColor: 'rgba(240, 244, 248, 0.92)', borderBottom: '1px solid rgba(194, 214, 230, 0.5)', display: 'flex', justifyContent: 'space-between', padding: '18px', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: '#6B99C3', cursor: 'pointer', fontSize: '15px', fontWeight: 600, padding: 0 }}>← 返回</button>
        <div style={{ color: '#2A527A', fontSize: '15px', fontWeight: 700 }}>私訊 {name}</div>
        <span style={{ width: '32px' }} />
      </header>
      <main style={{ margin: '0 auto', maxWidth: '680px', padding: '18px 16px 28px' }}>
        {loading && <div style={{ color: '#87ACCA', padding: '48px 0', textAlign: 'center' }}>正在準備私訊...</div>}
        {!loading && errorMessage && <p style={{ color: '#9F5E4C', lineHeight: 1.7 }}>{errorMessage}</p>}
        {!loading && data && <DirectMessageThread currentUserId={data.currentUser.id} messages={[]} onSend={handleSend} sending={sending} disabledMessage={disabledMessage} />}
      </main>
    </div>
  );
}
