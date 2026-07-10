import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase/client';
import Head from 'next/head';

function getSafeNextPath(nextPath) {
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//')) {
    return '/';
  }
  return nextPath;
}

function translateError(errorMsg) {
  if (!errorMsg) return '發生了點小錯誤，請稍後再試。';
  const msg = errorMsg.toLowerCase();
  if (msg.includes('invalid login credentials')) return '信箱或密碼錯誤，請再試一次。';
  if (msg.includes('user already registered')) return '這個信箱已經被註冊過了喔。';
  if (msg.includes('rate limit')) return '操作太頻繁了，請稍等一下再試。';
  if (msg.includes('password should be at least')) return '密碼長度至少需要 6 個字元。';
  if (msg.includes('token has expired or is invalid')) return '驗證碼錯誤或已過期，請確認後再試。';
  return errorMsg;
}

export default function Login() {
  const router = useRouter();
  
  // 表單狀態
  const [isLogin, setIsLogin] = useState(true);
  const [isVerify, setIsVerify] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI 狀態
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // OTP 狀態
  const [otp, setOtp] = useState(['', '', '', '']);
  const otpRefs = useRef([]);
  const [countdown, setCountdown] = useState(0);

  const nextPath = getSafeNextPath(typeof router.query.next === 'string' ? router.query.next : '/');

  // 倒數計時器
  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const validate = () => {
    if (!email.trim()) {
      setMessage('信箱不能為空');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setMessage('信箱格式似乎不太對喔');
      return false;
    }
    if (!password) {
      setMessage('密碼不能為空');
      return false;
    }
    if (password.length < 6) {
      setMessage('密碼長度至少需要 6 個字元');
      return false;
    }
    if (!isLogin && password !== confirmPassword) {
      setMessage('兩次輸入的密碼不一致');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setMessage('');
    setIsSuccess(false);

    if (!validate()) return;

    setSubmitting(true);

    try {
      if (isLogin) {
        // 登入
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(nextPath);
      } else {
        // 註冊
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        // 註冊成功，進入 OTP 驗證階段
        setIsVerify(true);
        setCountdown(60);
        setIsSuccess(true);
        setMessage('驗證碼已發送至您的信箱');
        
        // 自動對焦第一個輸入框
        setTimeout(() => {
          if (otpRefs.current[0]) otpRefs.current[0].focus();
        }, 100);
      }
    } catch (error) {
      console.error('操作失敗:', error);
      setMessage(translateError(error.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (code) => {
    setMessage('');
    setSubmitting(true);
    
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: 'signup'
      });
      
      if (error) throw error;
      
      // 驗證成功，跳轉大廳
      router.push(nextPath);
    } catch (error) {
      console.error('OTP 驗證失敗:', error);
      setIsSuccess(false);
      setMessage(translateError(error.message));
      // 清空驗證碼重新輸入
      setOtp(['', '', '', '']);
      if (otpRefs.current[0]) otpRefs.current[0].focus();
    } finally {
      setSubmitting(false);
    }
  };

  const resendOtp = async () => {
    if (countdown > 0) return;
    setMessage('');
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      setCountdown(60);
      setIsSuccess(true);
      setMessage('驗證碼已重新發送');
    } catch (error) {
      console.error('重新發送失敗:', error);
      setIsSuccess(false);
      setMessage(translateError(error.message));
    } finally {
      setSubmitting(false);
    }
  };

  // 處理 OTP 鍵盤事件
  const handleOtpChange = (index, value) => {
    if (isNaN(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.substring(value.length - 1); // 只保留最後輸入的一位
    setOtp(newOtp);

    // 檢查是否填滿 4 位
    const code = newOtp.join('');
    if (value && index < 3) {
      otpRefs.current[index + 1].focus();
    } else if (code.length === 4) {
      handleVerifyOtp(code);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1].focus();
    }
  };

  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text/plain').slice(0, 4).replace(/\D/g, '');
    if (!pastedData) return;
    
    const newOtp = [...otp];
    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }
    setOtp(newOtp);
    
    if (pastedData.length === 4) {
      otpRefs.current[3].focus();
      handleVerifyOtp(pastedData);
    } else {
      otpRefs.current[pastedData.length].focus();
    }
  };

  // 通用的 Input 樣式
  const inputStyle = {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    border: '1px solid rgba(255, 255, 255, 0.9)',
    borderRadius: '16px',
    boxSizing: 'border-box',
    color: '#2A527A',
    fontSize: '15px',
    outline: 'none',
    padding: '14px 16px 14px 46px',
    width: '100%',
    boxShadow: 'inset 0 2px 4px rgba(42, 63, 84, 0.02)',
    transition: 'all 0.2s',
  };

  const inputFocusStyle = (e) => {
    e.target.style.boxShadow = '0 0 0 3px rgba(107,153,195,0.2)'; 
    e.target.style.backgroundColor = '#FFFFFF';
  };
  const inputBlurStyle = (e) => {
    e.target.style.boxShadow = 'inset 0 2px 4px rgba(42, 63, 84, 0.02)'; 
    e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
  };

  return (
    <>
      <Head>
        <title>{isLogin ? '登入' : '註冊'} · 審美者</title>
      </Head>
      <div style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: '24px',
        overflow: 'hidden'
      }}>
        {/* 水彩流體背景 */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: '#F4F7FA', zIndex: -1, overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '70vw', height: '70vw', background: 'radial-gradient(circle, rgba(212,229,247,0.8) 0%, rgba(244,247,250,0) 70%)', borderRadius: '50%', filter: 'blur(60px)' }}></div>
          <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '80vw', height: '80vw', background: 'radial-gradient(circle, rgba(217,140,140,0.15) 0%, rgba(244,247,250,0) 70%)', borderRadius: '50%', filter: 'blur(80px)' }}></div>
          <div style={{ position: 'absolute', top: '20%', right: '10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, rgba(135,172,202,0.3) 0%, rgba(244,247,250,0) 70%)', borderRadius: '50%', filter: 'blur(50px)' }}></div>
        </div>

        <main style={{ maxWidth: '400px', width: '100%', position: 'relative', zIndex: 1 }}>
          <button
            type="button"
            onClick={() => isVerify ? setIsVerify(false) : router.push('/')}
            style={{
              background: 'rgba(255, 255, 255, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
              borderRadius: '99px',
              color: '#6B99C3',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '24px',
              padding: '8px 16px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 4px 12px rgba(42, 63, 84, 0.05)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.8)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.4)'; }}
          >
            <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            {isVerify ? '返回修改信箱' : '返回大廳'}
          </button>

          <section style={{
            backgroundColor: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.8)',
            borderRadius: '28px',
            boxShadow: '0 24px 60px rgba(42, 63, 84, 0.08)',
            padding: '40px 32px',
          }}>
            
            {/* 頂部 Icon */}
            <div style={{
              alignItems: 'center',
              background: 'linear-gradient(135deg, #E6EEF8 0%, #D4E5F7 100%)',
              border: '1px solid #FFFFFF',
              boxShadow: '0 8px 24px rgba(107, 153, 195, 0.15), inset 0 2px 4px rgba(255, 255, 255, 0.8)',
              borderRadius: '22px',
              display: 'flex',
              height: '64px',
              justifyContent: 'center',
              marginBottom: '24px',
              width: '64px',
            }}>
              {isVerify ? (
                <svg style={{ width: '32px', height: '32px', color: '#6B99C3' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              ) : (
                <span style={{ color: '#6B99C3', fontSize: '28px', fontWeight: 900 }}>審</span>
              )}
            </div>

            {/* OTP 驗證模式 */}
            {isVerify ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <h2 style={{ margin: '0 0 8px', color: '#2A3F54', fontSize: '22px' }}>輸入驗證碼</h2>
                  <p style={{ margin: 0, color: '#87ACCA', fontSize: '14px', lineHeight: 1.6 }}>
                    我們已發送 4 位數驗證碼至<br/>
                    <strong style={{ color: '#6B99C3' }}>{email}</strong>
                  </p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', margin: '10px 0' }}>
                  {otp.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => otpRefs.current[index] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleOtpChange(index, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(index, e)}
                      onPaste={handleOtpPaste}
                      style={{
                        width: '56px',
                        height: '64px',
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        border: '1px solid rgba(255, 255, 255, 0.9)',
                        borderRadius: '16px',
                        color: '#2A527A',
                        fontSize: '28px',
                        fontWeight: '700',
                        textAlign: 'center',
                        outline: 'none',
                        boxShadow: 'inset 0 2px 4px rgba(42, 63, 84, 0.02)',
                        transition: 'all 0.2s',
                      }}
                      onFocus={inputFocusStyle}
                      onBlur={inputBlurStyle}
                    />
                  ))}
                </div>

                {message && (
                  <div style={{
                    backgroundColor: isSuccess ? 'rgba(209, 237, 219, 0.5)' : 'rgba(244, 216, 205, 0.5)',
                    border: `1px solid ${isSuccess ? 'rgba(125, 201, 152, 0.6)' : 'rgba(224, 154, 137, 0.6)'}`,
                    borderRadius: '12px',
                    color: isSuccess ? '#2E6B43' : '#9F5E4C',
                    fontSize: '13px',
                    fontWeight: '500',
                    lineHeight: 1.6,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <span>{message}</span>
                  </div>
                )}

                <div style={{ textAlign: 'center', marginTop: '10px' }}>
                  <button
                    onClick={resendOtp}
                    disabled={countdown > 0 || submitting}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: countdown > 0 ? '#A0B9D0' : '#6B99C3',
                      cursor: countdown > 0 ? 'not-allowed' : 'pointer',
                      fontSize: '14px',
                      fontWeight: '600',
                      transition: 'color 0.2s'
                    }}
                  >
                    {countdown > 0 ? `重新發送 (${countdown}s)` : '沒有收到？重新發送'}
                  </button>
                </div>
              </div>
            ) : (
              // 登入 / 註冊表單模式
              <>
                {/* 膠囊切換器 */}
                <div style={{ background: 'rgba(255, 255, 255, 0.5)', border: '1px solid rgba(255, 255, 255, 0.8)', borderRadius: '99px', display: 'flex', marginBottom: '28px', padding: '4px', position: 'relative' }}>
                  <div style={{
                    position: 'absolute', top: '4px', left: isLogin ? '4px' : 'calc(50% - 2px)', width: 'calc(50% - 2px)', height: 'calc(100% - 8px)',
                    background: '#FFFFFF', borderRadius: '99px', boxShadow: '0 4px 12px rgba(42, 63, 84, 0.08)', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', zIndex: 1
                  }} />
                  <button type="button" onClick={() => { setIsLogin(true); setMessage(''); }} style={{ flex: 1, background: 'transparent', border: 'none', padding: '10px 0', fontSize: '15px', fontWeight: isLogin ? '700' : '500', color: isLogin ? '#2A3F54' : '#87ACCA', cursor: 'pointer', position: 'relative', zIndex: 2, transition: 'color 0.3s' }}>登入</button>
                  <button type="button" onClick={() => { setIsLogin(false); setMessage(''); }} style={{ flex: 1, background: 'transparent', border: 'none', padding: '10px 0', fontSize: '15px', fontWeight: !isLogin ? '700' : '500', color: !isLogin ? '#2A3F54' : '#87ACCA', cursor: 'pointer', position: 'relative', zIndex: 2, transition: 'color 0.3s' }}>註冊</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Email */}
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#87ACCA', display: 'flex' }}>
                      <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                    </div>
                    <input type="email" placeholder="信箱" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} onFocus={inputFocusStyle} onBlur={inputBlurStyle} />
                  </div>

                  {/* Password */}
                  <div style={{ position: 'relative' }}>
                    <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#87ACCA', display: 'flex' }}>
                      <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    </div>
                    <input type={showPassword ? "text" : "password"} placeholder="密碼" value={password} onChange={(e) => setPassword(e.target.value)} style={{...inputStyle, paddingRight: '46px'}} onFocus={inputFocusStyle} onBlur={inputBlurStyle} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#A0B9D0', cursor: 'pointer', padding: 0, display: 'flex' }}>
                      {showPassword ? (
                        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      ) : (
                        <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      )}
                    </button>
                  </div>

                  {/* Confirm Password (只在註冊模式顯示) */}
                  {!isLogin && (
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#87ACCA', display: 'flex' }}>
                        <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                      </div>
                      <input type={showConfirmPassword ? "text" : "password"} placeholder="確認密碼" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={{...inputStyle, paddingRight: '46px'}} onFocus={inputFocusStyle} onBlur={inputBlurStyle} />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#A0B9D0', cursor: 'pointer', padding: 0, display: 'flex' }}>
                        {showConfirmPassword ? (
                          <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        ) : (
                          <svg style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        )}
                      </button>
                    </div>
                  )}

                  {message && (
                    <div style={{ backgroundColor: 'rgba(244, 216, 205, 0.5)', border: '1px solid rgba(224, 154, 137, 0.6)', borderRadius: '12px', color: '#9F5E4C', fontSize: '13px', fontWeight: '500', lineHeight: 1.6, padding: '10px 14px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <svg style={{ width: '16px', height: '16px', marginTop: '2px', flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                      <span>{message}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    style={{
                      background: submitting ? 'rgba(107, 153, 195, 0.5)' : 'linear-gradient(135deg, #6B99C3 0%, #2A527A 100%)',
                      border: 'none',
                      borderRadius: '16px',
                      boxShadow: submitting ? 'none' : '0 8px 20px rgba(42, 82, 122, 0.15)',
                      color: 'white',
                      cursor: submitting ? 'not-allowed' : 'pointer',
                      fontSize: '16px',
                      fontWeight: 700,
                      padding: '14px',
                      marginTop: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { if(!submitting) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={(e) => { if(!submitting) e.currentTarget.style.transform = 'translateY(0)'; }}
                    onMouseDown={(e) => { if(!submitting) e.currentTarget.style.transform = 'translateY(1px)'; }}
                  >
                    {submitting ? (
                      <>
                        <svg style={{ animation: 'spin 1s linear infinite', width: '20px', height: '20px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>處理中...</span>
                        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                      </>
                    ) : (isLogin ? '進入大廳' : '註冊並發送驗證碼')}
                  </button>
                </form>
              </>
            )}
          </section>
        </main>
      </div>
    </>
  );
}
