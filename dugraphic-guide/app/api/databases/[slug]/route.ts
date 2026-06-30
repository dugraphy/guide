import { getDatabase } from "@/lib/databases";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const db = await getDatabase(slug);
  if (!db) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(db);
}
