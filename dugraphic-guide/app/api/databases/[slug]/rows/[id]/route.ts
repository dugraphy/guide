import { updateRow, deleteRow, syncMemoAcrossDBs } from "@/lib/databases";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const { slug, id } = await params;
  const data = (await request.json()) as Record<string, string>;
  const row = await updateRow(id, data);

  // Sync 메모 between "clients" ↔ "checklist" when either side saves.
  if ("메모" in data && (slug === "clients" || slug === "checklist")) {
    const 업체명 = data["업체명"] ?? "";
    await syncMemoAcrossDBs(slug, 업체명, data["메모"] ?? "");
  }

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
