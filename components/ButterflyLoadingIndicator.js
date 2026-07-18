import Image from 'next/image';

export default function ButterflyLoadingIndicator({ visible, label = '正在換一批採樣' }) {
  return (
    <div
      aria-hidden={!visible}
      aria-live="polite"
      className={`butterfly-loading-indicator${visible ? ' butterfly-loading-indicator--visible' : ''}`}
      role={visible ? 'status' : undefined}
    >
      <div className="butterfly-loading-indicator__mascot">
        <Image alt="" height={38} src="/brand/butterfly.svg" width={38} />
      </div>
      <span className="app-visually-hidden">{label}</span>
    </div>
  );
}
