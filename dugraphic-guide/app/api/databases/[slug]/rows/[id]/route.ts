import {
  updateRow,
  getRow,
  deleteRow,
  syncMemoAcrossDBs,
  syncStatusAcrossDBs,
  renameClientAcrossDBs,
} from "@/lib/databases";
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

  const existing = await getRow(id);
  const row = await updateRow(id, data);

  // 업체명 변경을 다른 두 데이터베이스에 먼저 반영한다 — 아래 메모/상태
  // 동기화가 (이미 이름이 바뀐) 대상 행을 정상적으로 찾을 수 있어야 하므로.
  if (existing && "업체명" in data) {
    const oldName = existing.data["업체명"] ?? "";
    const newName = data["업체명"] ?? "";
    if (oldName && oldName !== newName) {
      await renameClientAcrossDBs(slug, oldName, newName);
    }
  }

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
