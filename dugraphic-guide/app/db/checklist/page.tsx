import { redirect, notFound } from "next/navigation";
import { getDatabase, getRows } from "@/lib/databases";
import { getCanEdit, getSessionUser } from "@/lib/auth";
import ChecklistView from "./ChecklistView";

export const dynamic = "force-dynamic";

export default async function ChecklistPage() {
  const { role } = await getSessionUser();
  if (role !== "owner") {
    redirect("/");
  }

  const db = await getDatabase("checklist");
  if (!db) notFound();
  const [rows, canEdit] = await Promise.all([getRows(db.id), getCanEdit()]);
  return <ChecklistView db={db} initialRows={rows} canEdit={canEdit} />;
}
