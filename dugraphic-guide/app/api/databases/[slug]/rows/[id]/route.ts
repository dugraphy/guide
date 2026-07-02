import { updateRow, deleteRow, syncMemoAcrossDBs, syncStatusAcrossDBs } from "@/lib/databases";
import { requireOwnerOrForbidden } from "@/lib/auth";

const STATUS_FIELD_BY_SLUG: Record<string, string> = {
  clients: "상태",
  "inquiry-clients": "진행여부",
};

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { slug, id } = await params;
  const data = (await request.json()) as Record<string, string>;
  const row = await updateRow(id, data);

  // Sync 메모 between "clients" ↔ "checklist" when either side saves.
  if ("메모" in data && (slug === "clients" || slug === "checklist")) {
    const 업체명 = data["업체명"] ?? "";
    await syncMemoAcrossDBs(slug, 업체명, data["메모"] ?? "");
  }

  // Sync 상태(clients) ↔ 진행여부(inquiry-clients) when either side saves.
  const statusField = STATUS_FIELD_BY_SLUG[slug];
  if (statusField && statusField in data) {
    const 업체명 = data["업체명"] ?? "";
    await syncStatusAcrossDBs(slug, 업체명, data[statusField] ?? "");
  }

  return Response.json(row);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { id } = await params;
  await deleteRow(id);
  return new Response(null, { status: 204 });
}
