import { USER_ROLES } from '@/lib/auth/roles';

export default function AestheteBadge({ role }) {
  const label = role === USER_ROLES.AESTHETE ? '審美者' : null;

  if (!label) return null;

  return (
    <span
      title={label}
      style={{
        backgroundColor: 'var(--brand-blue-light)',
        border: '1px solid var(--border-light)',
        borderRadius: '4px',
        color: 'var(--brand-blue)',
        display: 'inline-flex',
        fontSize: '10px',
        fontWeight: 600,
        lineHeight: 1,
        padding: '3px 5px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}
