import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import DirectMessageThread from '@/components/DirectMessageThread';
import { requireLogin } from '@/lib/auth/requireLogin';
import { loadConversation, sendDirectMessage } from '@/lib/messages/directMessages';
import { cacheConversation, getCachedConversation } from '@/lib/cache/messagePageCache';
import { supabase } from '@/lib/supabase/client';

function getInitial(profile) {
  const name = profile?.display_name || profile?.username || '審';
  return name.charAt(0).toUpperCase();
}

export default function ConversationPage() {
  const router = useRouter();
  const { id } = router.query;
  const cachedConversation = id ? getCachedConversation(id) : null;
  const [data, setData] = useState(() => cachedConversation || null);
  const [loading, setLoading] = useState(() => !cachedConversation);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const refreshConversation = useCallback(async () => {
    const nextData = await loadConversation(id);
    cacheConversation(id, nextData);
    setData(nextData);
  }, [id]);

  useEffect(() => {
    if (!id) return;

    async function loadPage() {
      try {
        const user = await requireLogin({ router, nextPath: `/messages/${id}`, message: '請先登入，才能查看私訊。', replace: true });
        if (!user) return;
        const cached = getCachedConversation(id);
        if (cached) {
          setData(cached);
          setLoading(false);
        }
        await refreshConversation();
      } catch (error) {
        console.error('私訊內容載入失敗:', error);
        setErrorMessage(error.message || '這段私訊暫時無法顯示。');
      } finally {
        setLoading(false);
      }
    }

    loadPage();
  }, [id, refreshConversation, router]);

  useEffect(() => {
    if (!id || !data?.currentUser?.id) return undefined;

    const channel = supabase
      .channel(`conversation-${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, async (payload) => {
        const incomingMessage = payload.new;

        setData((currentData) => {
          if (!currentData || currentData.messages.some((message) => message.id === incomingMessage.id)) {
            return currentData;
          }

          const nextData = {
            ...currentData,
            messages: [...currentData.messages, incomingMessage],
          };
          cacheConversation(id, nextData);
          return nextData;
        });

        if (incomingMessage.receiver_id === data.currentUser.id) {
          const { error } = await supabase.rpc('mark_conversation_read', { target_conversation_id: id });
          if (error) console.error('即時訊息已讀標記失敗:', error);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [data?.currentUser?.id, id]);

  const handleSend = async (content) => {
    if (!data?.otherProfile) return;
    setSending(true);
    setErrorMessage('');
    try {
      await sendDirectMessage(data.otherProfile.id, content);
      await refreshConversation();
    } catch (error) {
      console.error('私訊傳送失敗:', error);
      setErrorMessage(error.message || '訊息傳送失敗，請稍後再試。');
    } finally {
      setSending(false);
    }
  };

  const profile = data?.otherProfile;
  const name = profile?.display_name || profile?.username || '私訊';

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', minHeight: '100vh' }}>
      <Head><title>{name} · 私訊 · 審美者</title></Head>
      <header style={{ alignItems: 'center', backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', padding: '48px 18px 14px', position: 'sticky', top: 0, zIndex: 10 }}>
        <button type="button" onClick={() => router.push('/messages')} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '15px', fontWeight: 500, padding: 0 }}>← 私訊</button>
        <div style={{ alignItems: 'center', display: 'flex', gap: '8px', minWidth: 0 }}>
          <span style={{ alignItems: 'center', backgroundColor: 'var(--bg-base)', backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', borderRadius: '50%', color: 'var(--text-secondary)', display: 'flex', flex: '0 0 auto', fontSize: '12px', fontWeight: 500, height: '26px', justifyContent: 'center', width: '26px', border: '1px solid var(--border-light)' }}>{!profile?.avatar_url && getInitial(profile)}</span>
          <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        </div>
        <button type="button" onClick={() => profile?.username && router.push(`/u/${profile.username}`)} style={{ background: 'transparent', border: 'none', color: 'var(--brand-blue)', cursor: 'pointer', fontSize: '13px', fontWeight: 500, padding: 0 }}>主頁</button>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '680px', padding: '18px 16px 28px' }}>
        {loading && <div style={{ color: 'var(--text-tertiary)', padding: '48px 0', textAlign: 'center' }}>正在打開私訊...</div>}
        {!loading && errorMessage && <p style={{ color: '#FF4D4F', lineHeight: 1.7 }}>{errorMessage}</p>}
        {!loading && data && <DirectMessageThread currentUserId={data.currentUser.id} messages={data.messages} onSend={handleSend} sending={sending} />}
      </main>
    </div>
  );
}
