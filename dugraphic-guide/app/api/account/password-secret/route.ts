import { getSessionUser } from "@/lib/auth";
import { upsertAccountSecret } from "@/lib/admin-users";

// 로그인한 사용자가 supabase.auth.updateUser(password)로 스스로 비밀번호를
// 바꾼 직후 호출된다. 브라우저에서 Supabase Auth로 직접 바뀐 새 비밀번호는
// 서버가 알 수 없으므로, 클라이언트가 이 값을 넘겨줘서 account_secrets에도
// 같이 기록되게 한다. 대상 id는 클라이언트 입력이 아니라 서버에서 검증한
// 세션에서만 가져와, 다른 사람의 account_secrets를 덮어쓸 수 없게 한다.
export async function POST(request: Request) {
  const { userId } = await getSessionUser();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = (await request.json()) as { password?: string };
  if (!password) {
    return Response.json({ error: "password is required" }, { status: 400 });
  }

  try {
    await upsertAccountSecret(userId, password);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "저장에 실패했습니다." },
      { status: 500 }
    );
  }
}
