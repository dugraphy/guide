import { getDatabase } from "@/lib/databases";
import { requireOwnerOrForbidden } from "@/lib/auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { slug } = await params;
  const db = await getDatabase(slug);
  if (!db) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(db);
}
