import PageShell, { PlaceholderNote } from '@/components/PageShell';

export default function ModulesPage() {
  return (
    <PageShell
      title="小館"
      subtitle="小館是審美者的主題板塊。"
    >
      <PlaceholderNote>
        小館列表正在整理展牆。第一版小館由管理員建立，使用者發布時可以選擇小館，也可以只發到大廳。
      </PlaceholderNote>
    </PageShell>
  );
}
