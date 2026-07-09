import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import PageShell, { PlaceholderNote } from '@/components/PageShell';
import { requireLogin } from '@/lib/auth/requireLogin';
import { supabase } from '@/lib/supabase/client';

const rowStyle = {
  alignItems: 'center',
  borderBottom: '1px solid rgba(194, 214, 230, 0.45)',
  display: 'flex',
  gap: '16px',
  justifyContent: 'space-between',
  padding: '16px 0',
};

const labelStyle = {
  color: '#2A527A',
  fontSize: '15px',
  fontWeight: 700,
  margin: 0,
};

const hintStyle = {
  color: '#87ACCA',
  fontSize: '13px',
  lineHeight: 1.7,
  margin: '6px 0 0',
};

export default function SettingsPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState(null);
  const [signingOut, setSigningOut] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    async function guardSettings() {
      try {
        const currentUser = await requireLogin({
          router,
          nextPath: '/settings',
          message: '請先登入，才能進入設定。',
          replace: true,
        });

        setUser(currentUser);
      } catch (error) {
        console.error('設定頁登入檢查失敗:', error);
        setMessage('登入狀態確認失敗，請稍後再試。');
      } finally {
        setChecking(false);
      }
    }

    guardSettings();
  }, [router]);

  const handleSignOut = async () => {
    setMessage('');
    setSigningOut(true);

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      router.push('/login');
    } catch (error) {
      console.error('登出失敗:', error);
      setMessage(error.message || '登出失敗，請稍後再試。');
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <PageShell
      title="設定"
      subtitle="管理你的審美者帳號。更多個人資料編輯功能會放在這裡。"
    >
      {checking && <PlaceholderNote>正在確認登入狀態...</PlaceholderNote>}

      {!checking && !user && (
        <PlaceholderNote>請先登入，才能管理帳號設定。</PlaceholderNote>
      )}

      {!checking && user && (
        <div>
          <div style={rowStyle}>
            <div>
              <p style={labelStyle}>目前帳號</p>
              <p style={hintStyle}>{user.email || '已登入使用者'}</p>
            </div>
          </div>

          <div style={rowStyle}>
            <div>
              <p style={labelStyle}>個人資料</p>
              <p style={hintStyle}>暱稱、頭像、簡介與審美標籤會在後續版本開放編輯。</p>
            </div>
            <button
              type="button"
              disabled
              style={{
                backgroundColor: '#F0F4F8',
                border: '1px solid #C2D6E6',
                borderRadius: '999px',
                color: '#87ACCA',
                cursor: 'not-allowed',
                flex: '0 0 auto',
                fontSize: '13px',
                fontWeight: 700,
                padding: '8px 12px',
              }}
            >
              準備中
            </button>
          </div>

          <div style={{ ...rowStyle, borderBottom: 'none' }}>
            <div>
              <p style={labelStyle}>登出</p>
              <p style={hintStyle}>離開這台裝置上的審美者登入狀態。</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                backgroundColor: signingOut ? '#C2D6E6' : '#2A527A',
                border: 'none',
                borderRadius: '999px',
                color: '#FFFFFF',
                cursor: signingOut ? 'wait' : 'pointer',
                flex: '0 0 auto',
                fontSize: '13px',
                fontWeight: 800,
                padding: '9px 14px',
              }}
            >
              {signingOut ? '登出中...' : '登出'}
            </button>
          </div>

          {message && (
            <div style={{
              backgroundColor: '#FFF7F4',
              border: '1px solid #F4D8CD',
              borderRadius: '12px',
              color: '#9F5E4C',
              fontSize: '14px',
              lineHeight: 1.6,
              marginTop: '14px',
              padding: '12px 14px',
            }}>
              {message}
            </div>
          )}
        </div>
      )}
    </PageShell>
  );
}
