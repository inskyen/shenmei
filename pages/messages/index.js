import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppBottomNav from '@/components/AppBottomNav';
import { requireLogin } from '@/lib/auth/requireLogin';
import { cacheConversation, getCachedConversation, getCachedMessageInbox, prefetchConversation, prefetchMessageInbox } from '@/lib/cache/messagePageCache';
import { supabase } from '@/lib/supabase/client';

function formatRelativeTime(timestamp) {
  if (!timestamp) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return '剛剛';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} 分`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} 時`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} 天`;
  const d = new Date(timestamp);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function getInitial(profile) {
  const name = profile?.display_name || profile?.username || '審';
  return name.charAt(0).toUpperCase();
}

// 根據名字生成 Soul 風格漸層背景色
function getAvatarGradient(name) {
  const gradients = [
    'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 100%)',
    'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
    'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
    'linear-gradient(135deg, #a6c0fe 0%, #f68084 100%)',
    'linear-gradient(135deg, #fbc2eb 0%, #a6c1ee 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
  ];
  const index = (name?.charCodeAt(0) || 0) % gradients.length;
  return gradients[index];
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
    // 樂觀更新：在進入前先用已有資料填入快取，讓下個頁面能「秒開」頭像與標題
    if (!getCachedConversation(conversation.id)) {
      cacheConversation(conversation.id, {
        currentUser: { id: currentUserId },
        otherProfile: conversation.otherProfile,
        messages: conversation.latestMessage ? [conversation.latestMessage] : [],
      });
    }

    router.prefetch(`/messages/${conversation.id}`);
    prefetchConversation(conversation.id).catch((error) => console.error('私訊預取失敗:', error));
    router.push(`/messages/${conversation.id}`);
  };

  return (
    <>
      <Head><title>私訊 · 審美者</title></Head>

      <div style={{
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: '100vh',
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
            私訊
          </span>
        </header>

        {/* 加載骨架 */}
        {loading && (
          <div>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} style={{ alignItems: 'center', borderBottom: '1px solid var(--border-light)', display: 'flex', gap: '14px', padding: '14px 20px' }}>
                <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '50%', flex: '0 0 52px', height: '52px', width: '52px', animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '4px', height: '14px', marginBottom: '10px', width: '38%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                  <div style={{ backgroundColor: 'var(--bg-surface)', borderRadius: '4px', height: '12px', width: '62%', animation: 'pulse 1.5s ease-in-out infinite' }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 錯誤狀態 */}
        {!loading && errorMessage && (
          <div style={{ color: '#FF4D4F', fontSize: '13px', padding: '48px 24px', textAlign: 'center' }}>
            {errorMessage}
          </div>
        )}

        {/* 空狀態 */}
        {!loading && !errorMessage && conversations.length === 0 && (
          <div style={{ alignItems: 'center', display: 'flex', flexDirection: 'column', gap: '16px', padding: '80px 32px', textAlign: 'center' }}>
            <div style={{
              alignItems: 'center',
              background: 'linear-gradient(135deg, var(--brand-blue) 0%, #818cf8 100%)',
              borderRadius: '50%',
              display: 'flex',
              fontSize: '32px',
              height: '72px',
              justifyContent: 'center',
              opacity: 0.15,
              width: '72px',
            }}>
              💬
            </div>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', fontWeight: 500, margin: '0 0 8px' }}>還沒有訊息</p>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>
                到某位策展人的個人頁，<br />和他說一句話吧。
              </p>
            </div>
          </div>
        )}

        {/* 對話列表 */}
        {!loading && !errorMessage && conversations.length > 0 && (
          <ul style={{ listStyle: 'none', margin: 0, padding: '0 0 96px' }}>
            {conversations.map((conversation) => {
              const profile = conversation.otherProfile;
              const name = profile?.display_name || profile?.username || '一位審美者';
              const preview = conversation.latestMessage?.content || '開始這段對話吧。';
              const timeStr = formatRelativeTime(conversation.latestMessage?.created_at || conversation.last_message_at);
              const unread = conversation.unreadCount || 0;
              const hasAvatar = !!profile?.avatar_url;
              const gradient = getAvatarGradient(name);

              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(conversation)}
                    onMouseEnter={() => prefetchConversation(conversation.id).catch(() => {})}
                    onTouchStart={() => prefetchConversation(conversation.id).catch(() => {})}
                    style={{
                      alignItems: 'stretch',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      gap: '14px',
                      padding: '0 0 0 20px',
                      textAlign: 'left',
                      transition: 'background 0.2s ease',
                      width: '100%',
                    }}
                    onMouseDown={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; }}
                    onMouseUp={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    onTouchEnd={(e) => { setTimeout(() => { if (e.currentTarget) e.currentTarget.style.background = 'transparent'; }, 200); }}
                  >
                    {/* 頭像 */}
                    <div style={{ alignSelf: 'center', flex: '0 0 auto', padding: '12px 0', position: 'relative' }}>
                      <div style={{
                        alignItems: 'center',
                        background: hasAvatar ? 'transparent' : gradient,
                        backgroundImage: hasAvatar ? `url(${profile.avatar_url})` : 'none',
                        backgroundPosition: 'center',
                        backgroundSize: 'cover',
                        borderRadius: '50%',
                        color: '#FFFFFF',
                        display: 'flex',
                        fontSize: '18px',
                        fontWeight: 600,
                        height: '48px',
                        justifyContent: 'center',
                        width: '48px',
                      }}>
                        {!hasAvatar && getInitial(profile)}
                      </div>
                      {/* Soul風格 未讀徽章 */}
                      {unread > 0 && (
                        <span style={{
                          alignItems: 'center',
                          backgroundColor: '#FF4D4F',
                          border: '2px solid var(--bg-base)',
                          borderRadius: '99px',
                          color: '#FFFFFF',
                          display: 'flex',
                          fontSize: '10px',
                          fontWeight: 700,
                          height: '20px',
                          justifyContent: 'center',
                          minWidth: '20px',
                          padding: '0 5px',
                          position: 'absolute',
                          right: '-2px',
                          top: '-2px',
                        }}>
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>

                    {/* 文字區域 */}
                    <div style={{ borderBottom: '1px solid var(--border-light)', display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center', minWidth: 0, padding: '12px 20px 12px 0' }}>
                      <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{
                          color: 'var(--text-primary)',
                          fontSize: '15px',
                          fontWeight: unread > 0 ? 600 : 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '70%',
                        }}>
                          {name}
                        </span>
                        <span style={{
                          color: unread > 0 ? 'var(--brand-blue)' : 'var(--text-tertiary)',
                          flex: '0 0 auto',
                          fontSize: '11px',
                        }}>
                          {timeStr}
                        </span>
                      </div>
                      <span style={{
                        color: unread > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                        display: 'block',
                        fontSize: '13px',
                        fontWeight: unread > 0 ? 500 : 400,
                        lineHeight: 1.5,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {preview}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AppBottomNav active="messages" />
    </>
  );
}
