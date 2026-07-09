import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase/client';

function getSafeNextPath(nextPath) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/';
  }

  return nextPath;
}

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true); // true = 登入模式，false = 註冊模式。
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nextPath = getSafeNextPath(typeof router.query.next === 'string' ? router.query.next : '/');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setSubmitting(true);

    try {
      // 目前先沿用 Supabase Email + Password。
      // 註冊成功後建立 profile 的流程，會在資料表與 SQL trigger 準備好後補上。
      const { data, error } = isLogin
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

      if (error) {
        throw error;
      }

      // 登入成功，或註冊後 Supabase 直接回傳 session 時，送回剛剛想去的頁面。
      // 這讓「游客點喜歡 / 發佈 → 登入 → 回原頁」的路徑保持順滑。
      if (isLogin || data?.session) {
        router.push(nextPath);
        return;
      }

      setMessage('註冊成功，請先去信箱確認帳號，再回來登入。');
    } catch (error) {
      // 開發階段保留詳細錯誤，方便確認 Supabase Auth / Email 設定是否正常。
      console.error('登入 / 註冊失敗:', error);
      setMessage(error.message || '登入失敗，請稍後再試。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      alignItems: 'center',
      background: 'linear-gradient(180deg, #F0F4F8 0%, #FFFFFF 100%)',
      color: '#2A527A',
      display: 'flex',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '32px 18px',
    }}>
      <main style={{ maxWidth: '420px', width: '100%' }}>
        <button
          type="button"
          onClick={() => router.push('/')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6B99C3',
            cursor: 'pointer',
            fontSize: '14px',
            marginBottom: '28px',
            padding: 0,
          }}
        >
          ← 先回大廳看看
        </button>

        <section style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(194, 214, 230, 0.65)',
          borderRadius: '24px',
          boxShadow: '0 18px 60px rgba(42, 82, 122, 0.10)',
          padding: '28px 24px',
        }}>
          <div style={{
            alignItems: 'center',
            backgroundColor: '#F0F4F8',
            border: '1px solid #C2D6E6',
            borderRadius: '20px',
            display: 'flex',
            height: '56px',
            justifyContent: 'center',
            marginBottom: '20px',
            width: '56px',
          }}>
            <span style={{ color: '#2A527A', fontSize: '24px', fontWeight: 900 }}>審</span>
          </div>

          <h1 style={{ color: '#2A527A', fontSize: '28px', lineHeight: 1.25, margin: 0 }}>
            {isLogin ? '登入審美者' : '申請成為策展人'}
          </h1>
          <p style={{ color: '#87ACCA', fontSize: '14px', lineHeight: 1.8, margin: '10px 0 22px' }}>
            {isLogin
              ? '回到你的策展大廳，繼續留下喜歡、推薦與審美痕跡。'
              : '註冊後就能把一支影片和你的推薦理由放進大廳。'}
          </p>

          {nextPath !== '/' && (
            <div style={{
              backgroundColor: '#F7FAFC',
              border: '1px solid rgba(194, 214, 230, 0.65)',
              borderRadius: '14px',
              color: '#6B99C3',
              fontSize: '13px',
              lineHeight: 1.7,
              marginBottom: '16px',
              padding: '10px 12px',
            }}>
              登入後就會帶你回到剛剛想去的地方。
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              type="email"
              placeholder="信箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                backgroundColor: '#F7FAFC',
                border: '1px solid rgba(135, 172, 202, 0.65)',
                borderRadius: '14px',
                boxSizing: 'border-box',
                color: '#2A527A',
                fontSize: '15px',
                outline: 'none',
                padding: '13px 14px',
                width: '100%',
              }}
            />
            <input
              type="password"
              placeholder="密碼"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                backgroundColor: '#F7FAFC',
                border: '1px solid rgba(135, 172, 202, 0.65)',
                borderRadius: '14px',
                boxSizing: 'border-box',
                color: '#2A527A',
                fontSize: '15px',
                outline: 'none',
                padding: '13px 14px',
                width: '100%',
              }}
            />
            {message && (
              <div style={{
                backgroundColor: '#FFF7F4',
                border: '1px solid #F4D8CD',
                borderRadius: '12px',
                color: '#9F5E4C',
                fontSize: '14px',
                lineHeight: 1.7,
                padding: '10px 12px',
              }}>
                {message}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting}
              style={{
                backgroundColor: submitting ? '#C2D6E6' : '#2A527A',
                border: 'none',
                borderRadius: '14px',
                color: 'white',
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: 800,
                padding: '13px 14px',
              }}
            >
              {submitting ? '處理中...' : (isLogin ? '登入' : '註冊')}
            </button>
            <p
              onClick={() => setIsLogin(!isLogin)}
              style={{
                color: '#6B99C3',
                cursor: 'pointer',
                fontSize: '14px',
                lineHeight: 1.7,
                margin: '2px 0 0',
                textAlign: 'center',
              }}
            >
              {isLogin ? '還沒有帳號？點此註冊' : '已經有帳號？點此登入'}
            </p>
          </form>
        </section>

        <p style={{ color: '#87ACCA', fontSize: '12px', lineHeight: 1.7, margin: '18px 10px 0', textAlign: 'center' }}>
          審美者還在早期施工中，請不要放入高度敏感資料。
        </p>
      </main>
    </div>
  );
}
