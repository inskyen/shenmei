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

export default function SettingsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  
  const [avatarUrl, setAvatarUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  
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
          .select('username, display_name, avatar_url, bio')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (error) throw error;
        
        if (data) {
          setUsername(data.username || '');
          setDisplayName(data.display_name || '');
          setAvatarUrl(data.avatar_url || '');
          setBio(data.bio || '');
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

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username: trimmedUsername,
          display_name: displayName.trim(),
          avatar_url: avatarUrl,
          bio: bio.trim(),
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

  if (checking) {
    return <div style={{ minHeight: '100vh', backgroundColor: '#F9FAFB', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#87ACCA' }}>正在讀取資料...</div>;
  }

  return (
    <div style={{
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
         <button onClick={() => router.back()} style={{ border: 'none', background: 'none', fontSize: '26px', color: '#87ACCA', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
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
