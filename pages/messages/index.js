import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import PageShell from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/requireLogin';
import { getCachedMessageInbox, prefetchConversation, prefetchMessageInbox } from '@/lib/cache/messagePageCache';
import { supabase } from '@/lib/supabase/client';

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return '剛剛';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分鐘前`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 小時前`;
  return `${Math.floor(seconds / 86400)} 天前`;
}

function getInitial(profile) {
  const name = profile?.display_name || profile?.username || '審';
  return name.charAt(0).toUpperCase();
}

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState(() => getCachedMessageInbox()?.conversations || []);
  const [loading, setLoading] = useState(() => !getCachedMessageInbox());
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUserId, setCurrentUserId] = useState('');

  useEffect(() => {
    async function loadInbox() {
      try {
        const user = await requireLogin({
          router,
          nextPath: '/messages',
          message: '請先登入，才能查看訊息。',
          replace: true,
        });

        if (!user) return;

        setCurrentUserId(user.id);
        const result = await prefetchMessageInbox({ force: true });
        setConversations(result.conversations);
      } catch (error) {
        console.error('訊息列表載入失敗:', error);
        setErrorMessage('訊息暫時無法顯示，請稍後再試。');
      } finally {
        setLoading(false);
      }
    }

    loadInbox();
  }, [router]);

  useEffect(() => {
    if (!currentUserId) return undefined;

    const channel = supabase
      .channel(`message-inbox-${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async () => {
        try {
          const result = await prefetchMessageInbox({ force: true });
          setConversations(result.conversations);
        } catch (error) {
          console.error('即時更新私訊列表失敗:', error);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  const openConversation = (conversation) => {
    router.prefetch(`/messages/${conversation.id}`);
    prefetchConversation(conversation.id).catch((error) => console.error('私訊預取失敗:', error));
    router.push(`/messages/${conversation.id}`);
  };

  return (
    <>
      <PageShell title="私訊" subtitle="因為一段審美而靠近的人，會留在這裡。">
        {loading && <div style={{ color: '#87ACCA', padding: '20px 0', textAlign: 'center' }}>正在整理訊息...</div>}

        {!loading && errorMessage && <p style={{ color: '#9F5E4C', lineHeight: 1.7, margin: 0 }}>{errorMessage}</p>}

        {!loading && !errorMessage && conversations.length === 0 && (
          <div style={{ color: '#87ACCA', lineHeight: 1.8, padding: '28px 8px', textAlign: 'center' }}>
            還沒有私訊。到某位策展人的個人頁，和他說一句話吧。
          </div>
        )}

        {!loading && !errorMessage && conversations.length > 0 && (
          <div style={{ display: 'grid', gap: '8px' }}>
            {conversations.map((conversation) => {
              const profile = conversation.otherProfile;
              const name = profile?.display_name || profile?.username || '一位審美者';
              const preview = conversation.latestMessage?.content || '開始這段對話吧。';

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => openConversation(conversation)}
                  onMouseEnter={() => prefetchConversation(conversation.id).catch((error) => console.error('私訊預取失敗:', error))}
                  onTouchStart={() => prefetchConversation(conversation.id).catch((error) => console.error('私訊預取失敗:', error))}
                  style={{ alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', gap: '12px', padding: '10px 2px', textAlign: 'left', width: '100%' }}
                >
                  <span style={{ alignItems: 'center', backgroundColor: '#D9E4F5', backgroundImage: profile?.avatar_url ? `url(${profile.avatar_url})` : 'none', backgroundPosition: 'center', backgroundSize: 'cover', borderRadius: '50%', color: '#6B99C3', display: 'flex', flex: '0 0 auto', fontSize: '17px', fontWeight: 800, height: '48px', justifyContent: 'center', width: '48px' }}>
                    {!profile?.avatar_url && getInitial(profile)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ color: '#2A527A', display: 'block', fontSize: '15px', fontWeight: 700 }}>{name}</span>
                    <span style={{ color: '#6B99C3', display: 'block', fontSize: '13px', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{preview}</span>
                  </span>
                  <span style={{ alignItems: 'flex-end', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ color: '#A0B9D0', fontSize: '11px' }}>{formatRelativeTime(conversation.latestMessage?.created_at || conversation.last_message_at)}</span>
                    {conversation.unreadCount > 0 && <span style={{ alignItems: 'center', backgroundColor: '#F4B9AE', borderRadius: '99px', color: '#FFFFFF', display: 'flex', fontSize: '10px', fontWeight: 700, height: '18px', justifyContent: 'center', minWidth: '18px', padding: '0 5px' }}>{conversation.unreadCount > 9 ? '9+' : conversation.unreadCount}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </PageShell>
      <AppBottomNav active="messages" />
    </>
  );
}
