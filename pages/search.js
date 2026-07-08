import PageShell, { PlaceholderNote } from '@/components/PageShell';

export default function SearchPage() {
  return (
    <PageShell
      title="探索"
      subtitle="這裡會成為搜尋 video 的入口。"
    >
      <PlaceholderNote>
        搜尋正在準備中。之後可以在這裡找到已收錄影片，也可以從 B 站連結開始新的策展。
      </PlaceholderNote>
    </PageShell>
  );
}
