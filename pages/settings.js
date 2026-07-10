import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { requireLogin } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';

const AVATAR_GROUPS = {
  mbti: [
    "/avatars/intj-architect.svg", "/avatars/intp-logician.svg", "/avatars/entj-commander.svg", "/avatars/entp-debater.svg",
    "/avatars/infj-advocate.svg", "/avatars/infp-mediator.svg", "/avatars/enfj-protagonist.svg", "/avatars/enfp-campaigner.svg",
    "/avatars/istj-logistician.svg", "/avatars/isfj-defender.svg", "/avatars/estj-executive.svg", "/avatars/esfj-consul.svg",
    "/avatars/istp-virtuoso.svg", "/avatars/isfp-adventurer.svg", "/avatars/estp-entrepreneur.svg", "/avatars/esfp-entertainer.svg"
  ],
  rings: Array.from({length: 16}, (_, i) => `/avatars/rings${i+1}.svg`),
  notion: Array.from({length: 16}, (_, i) => `/avatars/notion_${i+1}.svg`)
};

const TAG_SUGGESTIONS = ['電影', '音樂', '攝影', '設計', '閱讀', '動畫', '遊戲', '舞蹈'];

const MESSAGE_PERMISSION_OPTIONS = [
  { value: 'everyone', label: '所有人', description: '任何人都能向你發起私訊。' },
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
  const [messagePermission, setMessagePermission] = useState('followers');
  
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
          message: '請先登入，才能編輯資料。',
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
          setMessagePermission(data.message_permission || 'followers');
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

    // Frontend validation
    const trimmedUsername = username.trim();
    if (!trimmedUsername.match(/^[a-zA-Z0-9_]{3,32}$/)) {
      setMessage('審美號必須是 3~32 位的英文字母、數字或底線 ( _ )。');
      return;
    }
    
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
          username: trimmedUsername,
          display_name: displayName.trim(),
          avatar_url: avatarUrl,
          bio: bio.trim(),
          aesthetic_tags: aestheticTags,
          message_permission: messagePermission,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error(`這個審美號 (@${trimmedUsername}) 已經被註冊了，換一個試試吧！`);
        }
        throw error;
      }

      setMessageType('success');
      setMessage('資料更新成功！即將回到個人主页...');
      setTimeout(() => {
        router.push(`/u/${trimmedUsername}`);
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
      <div style={{ backgroundColor: '#F9FAFB', minHeight: '100vh', padding: '24px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="app-detail-skeleton" style={{ borderRadius: '50%', height: '34px', width: '34px' }} />
          <div className="app-detail-skeleton" style={{ height: '34px', width: '82px' }} />
        </div>
        <div style={{ display: 'grid', gap: '18px', marginTop: '44px' }}>
          <div className="app-detail-skeleton" style={{ borderRadius: '50%', height: '90px', justifySelf: 'center', width: '90px' }} />
          <div className="app-detail-skeleton" style={{ height: '132px' }} />
          <div className="app-detail-skeleton" style={{ height: '184px' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="app-detail-page" style={{
      backgroundColor: '#F9FAFB',
      minHeight: '100vh',
      color: '#2A527A',
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
        padding: '16px 20px',
        maxWidth: '680px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
         <button onClick={goBack} style={{ border: 'none', background: 'none', fontSize: '26px', color: '#87ACCA', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
           ×
         </button>
         <div style={{ fontSize: '17px', fontWeight: 600 }}>編輯資料</div>
         <button 
           onClick={handleSave} 
           disabled={saving}
           style={{
             backgroundColor: saving ? '#E1E9F0' : '#6B99C3',
             color: saving ? '#87ACCA' : '#FFFFFF',
             border: 'none',
             borderRadius: '20px',
             padding: '8px 24px',
             fontSize: '15px',
             fontWeight: 600,
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
            backgroundColor: '#E1E9F0',
            backgroundImage: avatarUrl ? `url("${avatarUrl}")` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(42,82,122,0.1)'
          }} />
          
          <div style={{ fontSize: '13px', color: '#87ACCA', marginBottom: '12px' }}>點擊選擇一個預設頭像</div>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', backgroundColor: '#F0F4F8', padding: '4px', borderRadius: '99px', width: '100%' }}>
            <button 
              onClick={() => setActiveGroup('mbti')}
              type="button"
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: '99px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: activeGroup === 'mbti' ? '#FFFFFF' : 'transparent',
                color: activeGroup === 'mbti' ? '#2A527A' : '#87ACCA',
                boxShadow: activeGroup === 'mbti' ? '0 2px 8px rgba(42,82,122,0.08)' : 'none'
              }}>16 型人格</button>
            <button 
              onClick={() => setActiveGroup('rings')}
              type="button"
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: '99px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: activeGroup === 'rings' ? '#FFFFFF' : 'transparent',
                color: activeGroup === 'rings' ? '#2A527A' : '#87ACCA',
                boxShadow: activeGroup === 'rings' ? '0 2px 8px rgba(42,82,122,0.08)' : 'none'
              }}>純粹光環</button>
            <button 
              onClick={() => setActiveGroup('notion')}
              type="button"
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: '99px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                backgroundColor: activeGroup === 'notion' ? '#FFFFFF' : 'transparent',
                color: activeGroup === 'notion' ? '#2A527A' : '#87ACCA',
                boxShadow: activeGroup === 'notion' ? '0 2px 8px rgba(42,82,122,0.08)' : 'none'
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
                  border: avatarUrl === svg ? '2px solid #6B99C3' : '2px solid transparent',
                  backgroundImage: `url("${svg}")`,
                  backgroundSize: 'contain',
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'center',
                  cursor: 'pointer',
                  padding: 0,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
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
        <section style={{ backgroundColor: '#FFFFFF', borderRadius: '16px', padding: '0 20px', boxShadow: '0 2px 12px rgba(42,82,122,0.04)' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(194, 214, 230, 0.4)', padding: '16px 0', alignItems: 'center' }}>
            <div style={{ width: '80px', fontSize: '15px', color: '#87ACCA' }}>暱稱</div>
            <input 
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="輸入你的暱稱"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', color: '#2A527A', background: 'transparent' }}
            />
          </div>

          <div style={{ display: 'flex', borderBottom: '1px solid rgba(194, 214, 230, 0.4)', padding: '16px 0', alignItems: 'center' }}>
            <div style={{ width: '80px', fontSize: '15px', color: '#87ACCA' }}>審美號</div>
            <div style={{ color: '#2A527A', fontSize: '15px', marginRight: '4px' }}>@</div>
            <input 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3~32位英數组合"
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', color: '#2A527A', background: 'transparent' }}
            />
          </div>

          <div style={{ display: 'flex', padding: '16px 0', alignItems: 'flex-start' }}>
            <div style={{ width: '80px', fontSize: '15px', color: '#87ACCA', paddingTop: '2px' }}>簡介</div>
            <textarea 
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="介紹一下你自己，或是你的審美偏好..."
              rows={3}
              style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', color: '#2A527A', background: 'transparent', resize: 'none', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ borderTop: '1px solid rgba(194, 214, 230, 0.4)', padding: '16px 0' }}>
            <div style={{ color: '#87ACCA', fontSize: '15px', marginBottom: '10px' }}>審美標籤</div>
            <input
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              placeholder="例如：電影、音樂、攝影"
              style={{ background: 'transparent', border: 'none', boxSizing: 'border-box', color: '#2A527A', fontSize: '15px', outline: 'none', width: '100%' }}
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
                      backgroundColor: isSelected ? '#D9E4F5' : '#F0F4F8',
                      border: isSelected ? '1px solid #87ACCA' : '1px solid transparent',
                      borderRadius: '999px',
                      color: isSelected ? '#2A527A' : '#6B99C3',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '6px 10px',
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(194, 214, 230, 0.4)', padding: '16px 0 4px' }}>
            <div style={{ color: '#87ACCA', fontSize: '15px', marginBottom: '10px' }}>私訊權限</div>
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
                      backgroundColor: isSelected ? '#F0F4F8' : 'transparent',
                      border: isSelected ? '1px solid #C2D6E6' : '1px solid transparent',
                      borderRadius: '12px',
                      color: '#2A527A',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '10px 12px',
                      textAlign: 'left',
                    }}
                  >
                    <span>
                      <strong style={{ fontSize: '13px' }}>{option.label}</strong>
                      <span style={{ color: '#87ACCA', display: 'block', fontSize: '12px', marginTop: '3px' }}>{option.description}</span>
                    </span>
                    <span style={{ color: isSelected ? '#2A527A' : '#C2D6E6', fontSize: '18px' }}>{isSelected ? '✓' : '○'}</span>
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
            borderRadius: '12px',
            fontSize: '14px',
            backgroundColor: messageType === 'success' ? '#F0FFF0' : '#FFF7F4',
            color: messageType === 'success' ? '#2A7A42' : '#9F5E4C',
            border: `1px solid ${messageType === 'success' ? '#A8E6CF' : '#F4D8CD'}`,
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
              color: '#9F5E4C', 
              fontSize: '15px', 
              cursor: 'pointer',
              fontWeight: 600,
              padding: '10px 20px'
            }}
          >
            登出當前帳號
          </button>
        </div>

      </main>
    </div>
  );
}
