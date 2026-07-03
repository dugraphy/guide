import { getDatabase, getRows, addRow } from "@/lib/databases";
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
  return Response.json(await getRows(db.id));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { slug } = await params;
  const db = await getDatabase(slug);
  if (!db) return Response.json({ error: "not found" }, { status: 404 });
  const data = (await request.json()) as Record<string, string>;
  const row = await addRow(db.id, data);
  return Response.json(row, { status: 201 });
}
