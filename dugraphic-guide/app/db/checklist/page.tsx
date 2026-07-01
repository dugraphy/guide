import { notFound } from "next/navigation";
import { getDatabase, getRows } from "@/lib/databases";
import ChecklistView from "./ChecklistView";

export default async function ChecklistPage() {
  const db = await getDatabase("checklist");
  if (!db) notFound();
  const rows = await getRows(db.id);
  return <ChecklistView db={db} initialRows={rows} />;
}
