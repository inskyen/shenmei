import PageShell, { PlaceholderNote } from '@/components/PageShell';

export default function FollowingPage() {
  return (
    <PageShell
      title="追蹤"
      subtitle="這裡會顯示你追蹤的人與小館。"
    >
      <PlaceholderNote>
        追蹤流正在準備中。第一版會先以大廳最新為核心，等追蹤關係完成後，這裡會變成更私人的審美時間線。
      </PlaceholderNote>
    </PageShell>
  );
}
