import PageHeader from "@/components/editor/PageHeader";

const PAGE_DATA: Record<string, { icon: string; title: string; description: string }> = {
  "getting-started": {
    icon: "📄",
    title: "시작하기",
    description: "프로젝트 개요와 사용 방법을 안내합니다.",
  },
  "design-system": {
    icon: "🎨",
    title: "디자인 시스템",
    description: "컴포넌트와 스타일 가이드를 정리한 공간입니다.",
  },
  notes: {
    icon: "📝",
    title: "노트",
    description: "자유롭게 메모를 남기는 공간입니다.",
  },
};

export default async function PageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = PAGE_DATA[slug] ?? {
    icon: "📄",
    title: slug,
    description: "",
  };

  return (
    <div>
      <PageHeader icon={page.icon} title={page.title} description={page.description} />
      <div className="max-w-3xl px-24 py-4">
        <div className="border-t border-[var(--border)] mb-8" />
        <p className="text-[var(--fg-muted)] text-sm">
          아직 내용이 없습니다. 여기를 클릭해 작성을 시작하세요.
        </p>
      </div>
    </div>
  );
}
