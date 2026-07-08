import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true); // true = 登入模式，false = 註冊模式。

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 目前先沿用 Supabase Email + Password。
    // 註冊成功後建立 profile 的流程，會在資料表與 SQL trigger 準備好後補上。
    const { data, error } = isLogin 
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    if (error) {
      // 開發階段先保留詳細錯誤，方便確認 Supabase Auth / Email 設定是否正常。
      console.error("DEBUG 錯誤詳情:", error);
      alert("出錯了，請看控制台：" + JSON.stringify(error));
    } else {
      console.log("成功回饋:", data);
      alert(isLogin ? "登入成功！" : "請去信箱確認註冊！");
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>{isLogin ? "歡迎回來" : "申請成為策展人"}</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input type="email" placeholder="信箱" onChange={(e) => setEmail(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc' }} />
        <input type="password" placeholder="密碼" onChange={(e) => setPassword(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc' }} />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#6B99C3', color: 'white' }}>
          {isLogin ? "登入" : "註冊"}
        </button>
        <p onClick={() => setIsLogin(!isLogin)} style={{ cursor: 'pointer', color: '#87ACCA' }}>
          {isLogin ? "還沒有帳號？點此註冊" : "已經有帳號？點此登入"}
        </p>
      </form>
    </div>
  );
}
