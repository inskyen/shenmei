import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { requireLogin } from '@/lib/auth/requireLogin';
import { cacheProfileRoute } from '@/lib/auth/profileRoute';
import { supabase } from '@/lib/supabase/client';

const AVATAR_GROUPS = {
  mbti: [
    "/avatars/intj-architect.svg", "/avatars/intp-logician.svg", "/avatars/entj-commander.svg", "/avatars/entp-debater.svg",
    "/avatars/infj-advocate.svg", "/avatars/infp-mediator.svg", "/avatars/enfj-protagonist.svg", "/avatars/enfp-campaigner.svg",
    "/avatars/istj-logistician.svg", "/avatars/isfj-defender.svg", "/avatars/estj-executive.svg", "/avatars/esfj-consul.svg",
    "/avatars/istp-virtuoso.svg", "/avatars/isfp-adventurer.svg", "/avatars/estp-entrepreneur.svg", "/avatars/esfp-entertainer.svg"
  ],
  momo: Array.from({length: 16}, (_, i) => `/avatars/momo${i+1}.svg`),
  notion: Array.from({length: 16}, (_, i) => `/avatars/notion_${i+1}.svg`)
};

const TAG_SUGGESTIONS = ['電影', '音樂', '攝影', '設計', '閱讀', '動畫', '遊戲', '舞蹈'];

const MESSAGE_PERMISSION_OPTIONS = [
  { value: 'everyone', label: '所有人', description: '任何人都能向您發起私訊。' },
  { value: 'followers', label: '追蹤者', description: '追蹤關係開放後，僅限追蹤者。' },
  { value: 'none', label: '暫不接收', description: '目前不接收新的私訊。' },
];

export default function SettingsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  
  const [avatarUrl, setAvatarUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [messagePermission, setMessagePermission] = useState('everyone');
  
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('error'); // 'error' or 'success'
  const [activeGroup, setActiveGroup] = useState('mbti');

  useEffect(() => {
    async function loadProfile() {
      try {
        const currentUser = await requireLogin({
          router,
          nextPath: '/settings',
          message: '請先登入',
          replace: true,
        });

        if (!currentUser) return;
        setUser(currentUser);

        const { data, error } = await supabase
          .from('profiles')
          .select('username, display_name, avatar_url, bio, aesthetic_tags, message_permission')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setUsername(data.username || '');
          setDisplayName(data.display_name || '');
          setAvatarUrl(data.avatar_url || '');
          setBio(data.bio || '');
          setTagInput((data.aesthetic_tags || []).join('、'));
          setMessagePermission(data.message_permission || 'everyone');
        }
      } catch (error) {
        console.error('設定頁載入失敗:', error);
        setMessage('資料載入失敗，請稍後再試。');
      } finally {
        setChecking(false);
      }
    }

    loadProfile();
  }, [router]);

  const handleSave = async () => {
    if (!user) return;
    setMessage('');
    setMessageType('error');

    if (displayName.trim().length === 0) {
      setMessage('暱稱不能為空。');
      return;
    }

    // 標籤以頓號、逗號或換行分隔；先在前端收斂格式，資料庫保留為 text[]。
    const aestheticTags = [...new Set(
      tagInput
        .split(/[、，,\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean)
    )];

    if (aestheticTags.length > 8) {
      setMessage('審美標籤最多選擇 8 個。');
      return;
    }

    if (aestheticTags.some((tag) => tag.length > 16)) {
      setMessage('每個審美標籤最多 16 個字。');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: displayName.trim(),
          avatar_url: avatarUrl,
          bio: bio.trim(),
          aesthetic_tags: aestheticTags,
          message_permission: messagePermission,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        throw error;
      }

      setMessageType('success');
      setMessage('資料更新成功！即將回到個人主页...');
      cacheProfileRoute(user.id, username);
      setTimeout(() => {
        router.push(`/u/${username}`);
      }, 1500);

    } catch (error) {
      console.error('更新資料失敗:', error);
      setMessage(error.message || '儲存失敗，請稍後再試。');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('登出失敗:', error);
    }
  };

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/u/me');
  };

  if (checking) {
    return (
      <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh', padding: '48px 20px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="app-detail-skeleton" style={{ borderRadius: '4px', height: '34px', width: '34px' }} />
          <div className="app-detail-skeleton" style={{ height: '34px', width: '82px', borderRadius: '4px' }} />
        </div>
        <div style={{ display: 'grid', gap: '18px', marginTop: '44px' }}>
          <div className="app-detail-skeleton" style={{ borderRadius: '50%', height: '90px', justifySelf: 'center', width: '90px' }} />
          <div className="app-detail-skeleton" style={{ height: '132px', borderRadius: '8px' }} />
          <div className="app-detail-skeleton" style={{ height: '184px', borderRadius: '8px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-detail-page" style={{
      backgroundColor: 'var(--bg-base)',
      minHeight: '100vh',
      color: 'var(--text-primary)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <Head>
        <title>編輯資料 · 審美者</title>
      </Head>

      {/* App Header */}
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '48px 20px 16px',
        maxWidth: '680px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
         <button onClick={goBack} style={{ border: 'none', background: 'none', fontSize: '26px', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            ×
         </button>
         <div style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>編輯資料</div>
         <button 
           onClick={handleSave} 
           disabled={saving}
           style={{
             backgroundColor: saving ? 'var(--border-light)' : 'var(--brand-blue)',
             color: saving ? 'var(--text-tertiary)' : '#FFFFFF',
             border: 'none',
             borderRadius: '6px',
             padding: '6px 20px',
             fontSize: '14px',
             fontWeight: 500,
             cursor: saving ? 'not-allowed' : 'pointer',
             transition: 'all 0.2s'
           }}
         >
           {saving ? '儲存中' : '儲存'}
         </button>
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px', maxWidth: '680px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Avatar Section */}
        <section style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '40px' }}>
          <div style={{
            width: '90px',
            height: '90px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-base)',
            backgroundImage: avatarUrl ? `url("${avatarUrl}")` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            marginBottom: '16px',
            border: '1px solid var(--border-light)'
          }} />
          
          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>點擊選擇一個預設頭像</div>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', backgroundColor: 'var(--bg-base)', padding: '4px', borderRadius: '6px', width: '100%', border: '1px solid var(--border-light)' }}>
            <button 
              onClick={() => setActiveGroup('mbti')}
              type="button"
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: activeGroup === 'mbti' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: activeGroup === 'mbti' ? 'var(--bg-surface)' : 'transparent',
                color: activeGroup === 'mbti' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>16 型人格</button>
            <button 
              onClick={() => setActiveGroup('momo')}
              type="button"
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: activeGroup === 'momo' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: activeGroup === 'momo' ? 'var(--bg-surface)' : 'transparent',
                color: activeGroup === 'momo' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>momo</button>
            <button 
              onClick={() => setActiveGroup('notion')}
              type="button"
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: '4px', fontSize: '13px', fontWeight: activeGroup === 'notion' ? 600 : 400, cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: activeGroup === 'notion' ? 'var(--bg-surface)' : 'transparent',
                color: activeGroup === 'notion' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}>手繪線條</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', width: '100%' }}>
            {AVATAR_GROUPS[activeGroup].map((svg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setAvatarUrl(svg)}
                style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '12px',
                  border: avatarUrl === svg ? '2px solid var(--brand-blue)' : '2px solid transparent',
                  backgroundImage: `url("${svg}")`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'transform 0.1s',
                }}
                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
              />
            ))}
          </div>
        </section>

        {/* Inputs Section */}
        <section style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-light)', borderRadius: '8px', padding: '0 20px' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', padding: '16px 0', alignItems: 'center' }}>
            <div style={{ width: '80px', fontSize: '15px', color: 'var(--text-secondary)' }}>暱稱</div>
            <input 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="輸入您的暱稱"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', color: 'var(--text-primary)', background: 'transparent' }}
            />
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid var(--border-light)', padding: '16px 0', alignItems: 'center' }}>
            <div style={{ width: '80px', fontSize: '15px', color: 'var(--text-secondary)' }}>審美號</div>
            <div style={{ color: 'var(--text-primary)', fontSize: '15px', marginRight: '4px' }}>@{username}</div>
            <div style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginLeft: 'auto' }}>暫不支援修改</div>
          </div>

          <div style={{ display: 'flex', padding: '16px 0', alignItems: 'flex-start' }}>
            <div style={{ width: '80px', fontSize: '15px', color: 'var(--text-secondary)', paddingTop: '2px' }}>簡介</div>
            <textarea 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="介紹一下您自己，或是您的審美偏好..."
              rows={3}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', color: 'var(--text-primary)', background: 'transparent', resize: 'none', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', padding: '16px 0' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '10px' }}>審美標籤</div>
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="例如：電影、音樂、攝影"
              style={{ background: 'transparent', border: 'none', boxSizing: 'border-box', color: 'var(--text-primary)', fontSize: '15px', outline: 'none', width: '100%' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
              {TAG_SUGGESTIONS.map((tag) => {
                const selectedTags = tagInput.split(/[、，,\n]/).map((item) => item.trim()).filter(Boolean);
                const isSelected = selectedTags.includes(tag);

                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => {
                      const nextTags = isSelected
                        ? selectedTags.filter((item) => item !== tag)
                        : [...selectedTags, tag];
                      setTagInput([...new Set(nextTags)].join('、'));
                    }}
                    style={{
                      backgroundColor: isSelected ? 'var(--brand-blue-light)' : 'var(--bg-base)',
                      border: isSelected ? '1px solid var(--brand-blue)' : '1px solid var(--border-light)',
                      borderRadius: '4px',
                      color: isSelected ? 'var(--brand-blue)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '6px 12px',
                      transition: 'all 0.2s',
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', padding: '16px 0 4px' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '10px' }}>私訊權限</div>
            <div style={{ display: 'grid', gap: '8px' }}>
              {MESSAGE_PERMISSION_OPTIONS.map((option) => {
                const isSelected = messagePermission === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMessagePermission(option.value)}
                    style={{
                      alignItems: 'center',
                      backgroundColor: isSelected ? 'var(--bg-base)' : 'transparent',
                      border: isSelected ? '1px solid var(--brand-blue)' : '1px solid transparent',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      textAlign: 'left',
                      transition: 'all 0.2s',
                    }}
                  >
                    <span>
                      <strong style={{ fontSize: '13px' }}>{option.label}</strong>
                      <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '12px', marginTop: '3px' }}>{option.description}</span>
                    </span>
                    <span style={{ color: isSelected ? 'var(--brand-blue)' : 'var(--text-tertiary)', fontSize: '18px' }}>{isSelected ? '✓' : '○'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {message && (
          <div style={{ 
            marginTop: '20px', 
            padding: '12px 16px', 
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '500',
            backgroundColor: 'var(--bg-surface)',
            color: messageType === 'success' ? 'var(--brand-blue)' : '#FF4D4F',
            border: `1px solid var(--border-light)`,
            textAlign: 'center'
          }}>
            {message}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: '40px', paddingBottom: '20px', display: 'flex', justifyContent: 'center' }}>
          <button 
            onClick={handleSignOut}
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#FF4D4F', 
              fontSize: '14px', 
              cursor: 'pointer',
              fontWeight: 500,
              padding: '10px 20px',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = 0.8}
            onMouseLeave={(e) => e.currentTarget.style.opacity = 1}
          >
            登出當前帳號
          </button>
        </div>

      </main>
    </div>
  );
}
