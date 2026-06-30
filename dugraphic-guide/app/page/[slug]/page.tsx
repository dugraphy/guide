import { notFound } from "next/navigation";
import PageHeader from "@/components/editor/PageHeader";
import EditorLoader from "@/components/editor/EditorLoader";
import { getPage } from "@/lib/pages";

export default async function PageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await getPage(slug);

  if (!page) notFound();

  return (
    <div>
      <PageHeader
        icon={page.icon}
        title={page.title}
        description={page.description}
      />
      <div className="max-w-3xl px-14 py-4">
        <div className="border-t border-[var(--border)] mb-4" />
        <EditorLoader page={page} />
      </div>
    </div>
  );
}
