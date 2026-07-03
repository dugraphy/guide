import { redirect, notFound } from "next/navigation";
import { getDatabase, getRows } from "@/lib/databases";
import { getCanEdit, getSessionUser } from "@/lib/auth";
import InquiryClientsView from "./InquiryClientsView";

export default async function InquiryClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { role } = await getSessionUser();
  if (role !== "owner") {
    redirect("/");
  }

  const { tab } = await searchParams;

  const db = await getDatabase("inquiry-clients");
  if (!db) notFound();

  const [rows, canEdit] = await Promise.all([getRows(db.id), getCanEdit()]);

  return (
    <InquiryClientsView
      db={db}
      initialRows={rows}
      initialTab={typeof tab === "string" ? tab : "전체"}
      canEdit={canEdit}
    />
  );
}
