import PageShell, { PlaceholderNote } from '@/components/PageShell';

export default function MessagesPage() {
  return (
    <PageShell
      title="訊息"
      subtitle="私訊會放在這裡，通知會獨立到通知頁。"
    >
      <PlaceholderNote>
        訊息室正在安靜搭建中。未來這裡會顯示一對一私訊與未讀狀態。
      </PlaceholderNote>
    </PageShell>
  );
}
