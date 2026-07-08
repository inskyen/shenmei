import PageShell, { PlaceholderNote } from '@/components/PageShell';

export default function NotificationsPage() {
  return (
    <PageShell
      title="通知"
      subtitle="評論、回覆、喜歡與追蹤會在這裡出現。"
    >
      <PlaceholderNote>
        通知還在整理光點。之後有人喜歡、留言或回覆你時，會在這裡亮起來。
      </PlaceholderNote>
    </PageShell>
  );
}
