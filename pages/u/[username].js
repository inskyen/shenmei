import { useRouter } from 'next/router';
import PageShell, { PlaceholderNote } from '@/components/PageShell';

export default function UserPage() {
  const router = useRouter();
  const { username } = router.query;

  return (
    <PageShell
      title={`策展人 / ${username || '...'}`}
      subtitle="第一版使用者頁會先展示基本資料與發布列表。"
    >
      <PlaceholderNote>
        使用者頁正在搭建中。未來每條策展動態都能回到發布者，看到他留下的審美痕跡。
      </PlaceholderNote>
    </PageShell>
  );
}
