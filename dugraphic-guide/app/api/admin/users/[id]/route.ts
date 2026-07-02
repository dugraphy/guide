import { requireOwnerOrForbidden, getSessionUser } from "@/lib/auth";
import { updateAccountRole, deleteAccount } from "@/lib/admin-users";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { id } = await params;
  const { role } = (await request.json()) as { role?: string };
  if (role !== "owner" && role !== "member") {
    return Response.json({ error: "잘못된 role 값입니다." }, { status: 400 });
  }

  const { userId } = await getSessionUser();
  if (id === userId) {
    return Response.json({ error: "본인의 권한은 변경할 수 없습니다." }, { status: 400 });
  }

  try {
    await updateAccountRole(id, role);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "권한 변경에 실패했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { id } = await params;
  const { userId } = await getSessionUser();
  if (id === userId) {
    return Response.json({ error: "본인 계정은 삭제할 수 없습니다." }, { status: 400 });
  }

  try {
    await deleteAccount(id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
