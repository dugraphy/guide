import { requireOwnerOrForbidden } from "@/lib/auth";
import { getAccountPassword } from "@/lib/admin-users";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { id } = await params;

  try {
    const password = await getAccountPassword(id);
    return Response.json({ password });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "비밀번호 조회에 실패했습니다." },
      { status: 500 }
    );
  }
}
