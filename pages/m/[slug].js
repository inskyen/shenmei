import { useRouter } from 'next/router';
import PageShell, { PlaceholderNote } from '@/components/PageShell';

export default function ModuleDetailPage() {
  const router = useRouter();
  const { slug } = router.query;

  return (
    <PageShell
      title={`小館 / ${slug || '...'}`}
      subtitle="這裡會展示某個小館下的策展動態。"
    >
      <PlaceholderNote>
        小館頁正在搭建中。之後會看到這個小館的介紹、最新策展動態，以及投稿入口。
      </PlaceholderNote>
    </PageShell>
  );
}
