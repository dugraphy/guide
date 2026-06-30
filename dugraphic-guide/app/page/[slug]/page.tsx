import { notFound } from "next/navigation";
import PageEditorWrapper from "@/components/editor/PageEditorWrapper";
import { getPage } from "@/lib/pages";

export default async function PageRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const { new: isNew } = await searchParams;
  const page = await getPage(slug);

  if (!page) notFound();

  return <PageEditorWrapper page={page} isNew={!!isNew} />;
}
