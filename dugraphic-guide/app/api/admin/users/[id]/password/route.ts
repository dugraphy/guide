import { requireOwnerOrForbidden } from "@/lib/auth";
import { getAccountPassword, resetAccountPassword } from "@/lib/admin-users";

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

// account_secrets에 기록이 없는(이 기능 도입 이전부터 있던) 계정에 새
// 비밀번호를 강제로 설정해 이후부터 조회 가능하게 만든다.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { id } = await params;
  const { password } = (await request.json()) as { password?: string };
  if (!password || password.length < 6) {
    return Response.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
  }

  try {
    await resetAccountPassword(id, password);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "비밀번호 재설정에 실패했습니다." },
      { status: 500 }
    );
  }
}
