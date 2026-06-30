import { updateRow, deleteRow } from "@/lib/databases";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { id } = await params;
  const data = (await request.json()) as Record<string, string>;
  const row = await updateRow(id, data);
  return Response.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { id } = await params;
  await deleteRow(id);
  return new Response(null, { status: 204 });
}
