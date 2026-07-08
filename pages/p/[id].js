import { useRouter } from 'next/router';
import PageShell, { PlaceholderNote } from '@/components/PageShell';

export default function PostPage() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <PageShell
      title={`策展動態 / ${id || '...'}`}
      subtitle="這裡會展示某個人的一次推薦。"
    >
      <PlaceholderNote>
        策展動態詳情正在搭建中。之後會展示推薦理由、影片、小館與針對這條推薦的留言。
      </PlaceholderNote>
    </PageShell>
  );
}
