import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase/client';

const pageStyle = {
  backgroundColor: '#F0F4F8',
  color: '#2A527A',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  minHeight: '100vh',
};

const cardStyle = {
  backgroundColor: '#FFFFFF',
  border: '1px solid rgba(194, 214, 230, 0.55)',
  borderRadius: '18px',
  boxShadow: '0 1px 4px rgba(42, 82, 122, 0.06)',
};

function getModuleInitial(name) {
  return name ? name.charAt(0).toUpperCase() : '館';
}

export default function ModulesPage() {
  const router = useRouter();
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    async function loadModules() {
      setLoading(true);
      setErrorMessage('');

      try {
        const { data, error } = await supabase
          .from('modules')
          .select('id, slug, name, description, cover_url, theme_color, created_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

        setModules(data || []);
      } catch (error) {
        console.error('小館列表載入失敗:', error);
        setErrorMessage('小館列表暫時無法顯示，請稍後再試。');
      } finally {
        setLoading(false);
      }
    }

    loadModules();
  }, []);

  return (
    <div style={pageStyle}>
      <Head>
        <title>小館 · 審美者</title>
      </Head>

      <header style={{
        alignItems: 'center',
        backgroundColor: 'rgba(240, 244, 248, 0.92)',
        backdropFilter: 'blur(14px)',
        borderBottom: '1px solid rgba(194, 214, 230, 0.5)',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '18px 18px 14px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <button
          type="button"
          onClick={() => router.push('/')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#6B99C3',
            cursor: 'pointer',
            fontSize: '15px',
            fontWeight: 600,
            padding: 0,
          }}
        >
          ← 大廳
        </button>
        <div style={{ color: '#2A527A', fontSize: '15px', fontWeight: 700 }}>小館</div>
        <button
          type="button"
          onClick={() => router.push('/submit')}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #C2D6E6',
            borderRadius: '999px',
            color: '#6B99C3',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
            padding: '7px 10px',
          }}
        >
          發佈
        </button>
      </header>

      <main style={{ margin: '0 auto', maxWidth: '760px', padding: '22px 16px 88px' }}>
        <section style={{ marginBottom: '18px' }}>
          <h1 style={{ color: '#2A527A', fontSize: '26px', lineHeight: 1.25, margin: 0 }}>
            小館
          </h1>
          <p style={{ color: '#87ACCA', fontSize: '14px', lineHeight: 1.8, margin: '8px 0 0' }}>
            以主題收納審美。第一版小館由管理員建立，發布時可以選，也可以只留在大廳。
          </p>
        </section>

        {loading && (
          <div style={{ color: '#87ACCA', padding: '44px 0', textAlign: 'center' }}>
            正在整理小館...
          </div>
        )}

        {!loading && errorMessage && (
          <section style={{ ...cardStyle, padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ color: '#87ACCA', lineHeight: 1.8 }}>{errorMessage}</div>
          </section>
        )}

        {!loading && !errorMessage && modules.length === 0 && (
          <section style={{ ...cardStyle, color: '#87ACCA', lineHeight: 1.8, padding: '28px 20px', textAlign: 'center' }}>
            目前還沒有開放中的小館。先讓大廳流動起來，之後再慢慢分館。
          </section>
        )}

        {!loading && modules.length > 0 && (
          <section style={{ display: 'grid', gap: '12px' }}>
            {modules.map((module) => (
              <button
                key={module.id}
                type="button"
                onClick={() => router.push(`/m/${module.slug}`)}
                style={{
                  ...cardStyle,
                  cursor: 'pointer',
                  display: 'grid',
                  gap: '14px',
                  gridTemplateColumns: '64px 1fr',
                  padding: '14px',
                  textAlign: 'left',
                }}
              >
                <div style={{
                  alignItems: 'center',
                  backgroundColor: module.theme_color || '#C2D6E6',
                  backgroundImage: module.cover_url ? `url(${module.cover_url})` : 'none',
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                  borderRadius: '16px',
                  color: '#FFFFFF',
                  display: 'flex',
                  fontSize: '22px',
                  fontWeight: 900,
                  height: '64px',
                  justifyContent: 'center',
                  width: '64px',
                }}>
                  {module.cover_url ? '' : getModuleInitial(module.name)}
                </div>

                <div style={{ minWidth: 0 }}>
                  <div style={{ color: '#2A527A', fontSize: '17px', fontWeight: 800 }}>{module.name}</div>
                  <div style={{ color: '#87ACCA', fontSize: '12px', marginTop: '3px' }}>
                    /m/{module.slug}
                  </div>
                  <p style={{ color: '#6B99C3', fontSize: '13px', lineHeight: 1.7, margin: '8px 0 0' }}>
                    {module.description || '這座小館還在等第一段介紹。'}
                  </p>
                </div>
              </button>
            ))}
          </section>
        )}
      </main>
    </div>
  );
}
