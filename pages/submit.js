import PageShell, { PlaceholderNote } from '@/components/PageShell';

export default function SubmitPage() {
  return (
    <PageShell
      title="發佈策展"
      subtitle="第一版會從 B 站影片與推薦理由開始。"
    >
      <PlaceholderNote>
        發佈表單下一步施工。這裡會填 B 站連結 / BVID、推薦理由，並可選小館；發布後回到大廳最新流。
      </PlaceholderNote>
    </PageShell>
  );
}
