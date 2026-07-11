import { useRouter } from 'next/router';
import { requireLogin } from '@/lib/auth/requireLogin';
import { prefetchModules } from '@/lib/cache/modulePageCache';
import { supabase } from '@/lib/supabase/client';
import { showToast } from '@/lib/ui/toast';

const activeColor = '#2A527A';
const inactiveColor = '#87ACCA';

export default function AppBottomNav({ active }) {
  const router = useRouter();

  const goToProtectedPage = async (path, message) => {
    const user = await requireLogin({ router, nextPath: path, message });
    if (user) router.push(path);
  };

  const goToMyProfile = async () => {
    const user = await requireLogin({
      router,
      nextPath: '/u/me',
      message: '請先登入，才能進入你的策展人頁。',
    });

    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data?.username) {
      showToast('暫時找不到你的個人頁，請稍後再試。');
      return;
    }

    router.push(`/u/${data.username}`);
  };

  const goToModules = () => {
    router.prefetch('/m');
    prefetchModules().catch((error) => console.error('小館列表預取失敗:', error));
    router.push('/m');
  };

  const itemStyle = (name) => ({
    alignItems: 'center',
    color: active === name ? activeColor : inactiveColor,
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
  });

  return (
    <nav style={{ alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(16px)', border: 'none', borderTop: '1px solid rgba(194, 214, 230, 0.5)', bottom: 0, boxShadow: '0 -4px 14px rgba(42, 82, 122, 0.05)', display: 'flex', height: '80px', left: 0, maxWidth: 'none', padding: '8px 8px 16px', position: 'fixed', transform: 'none', width: '100%', zIndex: 100 }}>
      <div onClick={() => router.push('/')} style={itemStyle('home')}>
        <svg style={{ height: '22px', marginBottom: '3px', width: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 10.5L12 3l9 7.5V21a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1V10.5z" /></svg>
        <span style={{ fontSize: '10px', fontWeight: active === 'home' ? 700 : 500 }}>首頁</span>
      </div>
      <div onClick={goToModules} onMouseEnter={() => prefetchModules().catch((error) => console.error('小館列表預取失敗:', error))} onTouchStart={() => prefetchModules().catch((error) => console.error('小館列表預取失敗:', error))} style={itemStyle('modules')}>
        <svg style={{ height: '22px', marginBottom: '3px', width: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M4 5.5A1.5 1.5 0 015.5 4H10v7H4V5.5zM14 4h4.5A1.5 1.5 0 0120 5.5V11h-6V4zM4 15h6v5H5.5A1.5 1.5 0 014 18.5V15zM14 15h6v3.5a1.5 1.5 0 01-1.5 1.5H14v-5z" /></svg>
        <span style={{ fontSize: '10px', fontWeight: active === 'modules' ? 700 : 500 }}>小館</span>
      </div>
      <div onClick={() => goToProtectedPage('/submit', '請先登入，才能發佈策展。')} style={{ ...itemStyle('submit'), color: '#6B99C3', marginTop: '-22px' }}>
        <div style={{ alignItems: 'center', backgroundColor: '#6B99C3', border: '4px solid #FFFFFF', borderRadius: '50%', boxShadow: '0 4px 10px rgba(107, 153, 195, 0.4)', color: '#FFFFFF', display: 'flex', height: '48px', justifyContent: 'center', width: '48px' }}>
          <svg style={{ height: '24px', width: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
        </div>
        <span style={{ fontSize: '10px', fontWeight: 700, marginTop: '4px' }}>發布</span>
      </div>
      <div onClick={() => goToProtectedPage('/messages', '請先登入，才能查看訊息。')} style={itemStyle('messages')}>
        <svg style={{ height: '22px', marginBottom: '3px', width: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        <span style={{ fontSize: '10px', fontWeight: active === 'messages' ? 700 : 500 }}>私訊</span>
      </div>
      <div onClick={goToMyProfile} style={itemStyle('profile')}>
        <svg style={{ height: '22px', marginBottom: '3px', width: '22px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
        <span style={{ fontSize: '10px', fontWeight: active === 'profile' ? 700 : 500 }}>我的</span>
      </div>
    </nav>
  );
}
