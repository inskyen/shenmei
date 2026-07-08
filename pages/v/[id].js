import { useRouter } from 'next/router';
import PageShell, { PlaceholderNote } from '@/components/PageShell';

export default function VideoPage() {
  const router = useRouter();
  const { id } = router.query;

  return (
    <PageShell
      title={`影片 / ${id || '...'}`}
      subtitle="影片主頁會沉澱播放、所有推薦與公共留言。"
    >
      <PlaceholderNote>
        影片頁正在搭建中。這裡之後會像 B 站影片頁一樣，以 video 為核心展示所有策展與討論。
      </PlaceholderNote>
    </PageShell>
  );
}
