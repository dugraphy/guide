import { notFound } from "next/navigation";
import { getDatabase, getRows } from "@/lib/databases";
import InquiryClientsView from "./InquiryClientsView";

export default async function InquiryClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tab } = await searchParams;

  const db = await getDatabase("inquiry-clients");
  if (!db) notFound();

  const rows = await getRows(db.id);

  return (
    <InquiryClientsView
      db={db}
      initialRows={rows}
      initialTab={typeof tab === "string" ? tab : "전체"}
    />
  );
}
