import { notFound } from "next/navigation";
import PageHeader from "@/components/editor/PageHeader";
import { getPage } from "@/lib/data";

export default async function PageRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getPage(slug);

  if (!page) notFound();

  return (
    <div>
      <PageHeader
        icon={page.icon}
        title={page.title}
        description={page.description}
      />
      <div className="max-w-3xl px-24 py-4">
        <div className="border-t border-[var(--border)] mb-8" />
        <div className="text-sm text-[var(--fg)] leading-7 whitespace-pre-wrap">
          {page.body}
        </div>
      </div>
    </div>
  );
}
