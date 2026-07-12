import Head from 'next/head';
import Link from 'next/link';

// 臨時頁面殼：讓 MVP 的每個路由先有一致的審美者氣質。
// 後續做正式設計時，可以把這裡替換成 Layout / BottomNav / TopTabs 等更細的元件。
export default function PageShell({ title, subtitle, children }) {
  return (
    <div style={{
      backgroundColor: 'var(--bg-base)',
      minHeight: '100vh',
      color: 'var(--text-primary)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      padding: '48px 18px 96px',
    }}>
      <Head>
        <title>{title} · 審美者</title>
      </Head>

      <main style={{ maxWidth: '680px', margin: '0 auto' }}>
        <Link href="/" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>
          ← 回大廳
        </Link>

        <header style={{ marginTop: '24px', marginBottom: '20px' }}>
          <h1 style={{ fontSize: '22px', margin: 0, fontWeight: 600 }}>{title}</h1>
          {subtitle && (
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: '8px', fontSize: '13px' }}>{subtitle}</p>
          )}
        </header>

        <section style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-light)',
          borderRadius: '8px',
          padding: '20px',
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
    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
      {children}
    </p>
  );
}
