import { useRouter } from 'next/router';

export default function GuestEmptyState({ message = '請先登入，才能查看此頁面' }) {
  const router = useRouter();

  return (
    <div style={{
      alignItems: 'center',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center',
      minHeight: '60vh', // Ensure it takes up vertical space
    }}>
      <img
        src="/brand/butterfly.svg"
        alt="Mascot"
        style={{
          width: '120px',
          height: '120px',
          marginBottom: '16px',
          objectFit: 'contain'
        }}
      />
      
      <p style={{
        color: 'var(--text-secondary)',
        fontSize: '14px',
        marginBottom: '24px',
      }}>
        {message}
      </p>

      <button
        type="button"
        onClick={() => router.push(`/login?next=${encodeURIComponent(router.asPath)}`)}
        style={{
          backgroundColor: 'var(--brand-blue)',
          border: 'none',
          borderRadius: '24px',
          color: '#ffffff',
          cursor: 'pointer',
          fontSize: '15px',
          fontWeight: 600,
          padding: '12px 48px',
          boxShadow: '0 4px 12px rgba(29, 155, 240, 0.2)',
        }}
      >
        登入 / 註冊
      </button>
    </div>
  );
}
