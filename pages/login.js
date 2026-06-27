import { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase 客户端 (记得替换成您的项目URL和KEY)
const supabase = createClient('https://ylrmyuczysjwsgiizvzk.supabase.co', 'sb_publishable_nSe5ZQTap3KqfZApF7hTTA_AHc3v4iP');

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true); // 切换开关

    const handleSubmit = async (e) => {
    e.preventDefault();
    
    const { data, error } = isLogin 
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    if (error) {
        // 关键修正：看看错误对象里到底是什么
        console.error("DEBUG错误详情:", error);
        alert("出错了，请看控制台：" + JSON.stringify(error));
    } else {
        console.log("成功反馈:", data);
        alert(isLogin ? "登录成功！" : "请去邮箱确认注册！");
    }
    };

  return (
    <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>{isLogin ? "欢迎回归" : "申请成为策展人"}</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <input type="email" placeholder="邮箱" onChange={(e) => setEmail(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc' }} />
        <input type="password" placeholder="密码" onChange={(e) => setPassword(e.target.value)} style={{ padding: '10px', border: '1px solid #ccc' }} />
        <button type="submit" style={{ padding: '10px', backgroundColor: '#6B99C3', color: 'white' }}>
          {isLogin ? "登录" : "注册"}
        </button>
        <p onClick={() => setIsLogin(!isLogin)} style={{ cursor: 'pointer', color: '#87ACCA' }}>
          {isLogin ? "没有账号？点击注册" : "已有账号？点击登录"}
        </p>
      </form>
    </div>
  );
}