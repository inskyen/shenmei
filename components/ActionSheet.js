export default function ActionSheet({
  open,
  actions = [], // Array of { label, onClick, color, loading, bold }
  onCancel,
}) {
  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onCancel}
      style={{
        alignItems: 'flex-end',
        backgroundColor: 'rgba(0, 0, 0, 0.42)',
        display: 'flex',
        inset: 0,
        justifyContent: 'center',
        padding: '24px 16px env(safe-area-inset-bottom)',
        position: 'fixed',
        zIndex: 1000,
        transition: 'opacity 0.2s',
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          animation: 'actionSheetSlideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
          maxWidth: '568px',
          width: '100%',
        }}
      >
        {actions.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderRadius: '14px',
              overflow: 'hidden',
              marginBottom: '8px',
            }}
          >
            {actions.map((action, index) => (
              <button
                key={index}
                type="button"
                disabled={action.loading}
                onClick={action.onClick}
                style={{
                  background: 'transparent',
                  border: 'none',
                  borderBottom: index < actions.length - 1 ? '1px solid var(--border-light)' : 'none',
                  color: action.color || 'var(--text-primary)',
                  cursor: action.loading ? 'wait' : 'pointer',
                  display: 'block',
                  fontSize: '17px',
                  fontWeight: action.bold ? 600 : 400,
                  opacity: action.loading ? 0.6 : 1,
                  padding: '16px',
                  textAlign: 'center',
                  width: '100%',
                }}
              >
                {action.loading ? '處理中…' : action.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={onCancel}
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: 'none',
            borderRadius: '14px',
            color: 'var(--brand-blue)',
            cursor: 'pointer',
            display: 'block',
            fontSize: '17px',
            fontWeight: 600,
            padding: '16px',
            textAlign: 'center',
            width: '100%',
          }}
        >
          取消
        </button>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes actionSheetSlideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}} />
    </div>
  );
}
