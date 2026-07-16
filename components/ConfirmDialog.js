export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '確認',
  loading = false,
  onCancel,
  onConfirm,
}) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={loading ? undefined : onCancel}
      style={{
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.42)',
        display: 'flex',
        inset: 0,
        justifyContent: 'center',
        padding: '24px',
        position: 'fixed',
        zIndex: 1000,
      }}
    >
      <section
        aria-modal="true"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '12px',
          boxShadow: '0 18px 48px rgba(0, 0, 0, 0.2)',
          maxWidth: '320px',
          overflow: 'hidden',
          textAlign: 'center',
          width: '100%',
        }}
      >
        <div style={{ padding: '26px 22px 22px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: 600, margin: 0 }}>{title}</h2>
          {description && <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.7, margin: '10px 0 0' }}>{description}</p>}
        </div>
        <div style={{ borderTop: '1px solid var(--border-light)', display: 'flex' }}>
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            style={{ background: 'transparent', border: 'none', borderRight: '1px solid var(--border-light)', color: 'var(--text-secondary)', cursor: loading ? 'wait' : 'pointer', flex: 1, fontSize: '15px', padding: '13px 0' }}
          >
            取消
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            style={{ background: 'transparent', border: 'none', color: '#D94848', cursor: loading ? 'wait' : 'pointer', flex: 1, fontSize: '15px', fontWeight: 600, padding: '13px 0' }}
          >
            {loading ? '處理中…' : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
