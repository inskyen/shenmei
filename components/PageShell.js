import Head from 'next/head';
import Link from 'next/link';

// 臨時頁面殼：讓 MVP 的每個路由先有一致的審美者氣質。
// 後續做正式設計時，可以把這裡替換成 Layout / BottomNav / TopTabs 等更細的元件。
export default function PageShell({ title, subtitle, children }) {
  return (
    <div style={{
      backgroundColor: '#F0F4F8',
      minHeight: '100vh',
      color: '#2A527A',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '32px 18px 96px',
    }}>
      <Head>
        <title>{title} · 審美者</title>
      </Head>

      <main style={{ maxWidth: '680px', margin: '0 auto' }}>
        <Link href="/" style={{ color: '#6B99C3', textDecoration: 'none', fontSize: '14px' }}>
          ← 回大廳
        </Link>

        <header style={{ marginTop: '28px', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '28px', margin: 0, letterSpacing: '0.02em' }}>{title}</h1>
          {subtitle && (
            <p style={{ color: '#87ACCA', lineHeight: 1.7, marginTop: '10px' }}>{subtitle}</p>
          )}
        </header>

        <section style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(194, 214, 230, 0.6)',
          borderRadius: '18px',
          padding: '22px',
          boxShadow: '0 1px 3px rgba(42,82,122,0.06)',
        }}>
          {children}
        </section>
      </main>
    </div>
  );
}

// 統一占位文字：目前先讓按鈕能到頁面，正式功能再逐步補上。
export function PlaceholderNote({ children }) {
  return (
    <p style={{ color: '#87ACCA', lineHeight: 1.8, margin: 0 }}>
      {children}
    </p>
  );
}
