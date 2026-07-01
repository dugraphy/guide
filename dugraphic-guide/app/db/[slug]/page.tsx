import { notFound } from "next/navigation";
import { getDatabase, getRows } from "@/lib/databases";
import DatabaseView from "./DatabaseView";

export const dynamic = "force-dynamic";

export default async function DbPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const { status, 업종, highlight } = await searchParams;

  const db = await getDatabase(slug);
  if (!db) notFound();

  const rows = await getRows(db.id);

  return (
    <DatabaseView
      db={db}
      initialRows={rows}
      initialStatus={typeof status === "string" ? status : "전체"}
      initialIndustry={typeof 업종 === "string" ? 업종 : ""}
      initialHighlight={typeof highlight === "string" ? highlight : undefined}
    />
  );
}
