import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { upsertAccountSecret } from "@/lib/admin-users";

// 강제 비밀번호 변경 화면에서, 새 비밀번호 설정(updateUser) 직후 호출된다.
// 대상 id는 클라이언트 입력이 아니라 서버에서 검증한 세션에서만 가져온다.
// 새 비밀번호 값은 서버가 알 수 없으므로(브라우저에서 Supabase Auth로 직접
// 바꿈) 클라이언트가 body로 넘겨주면 account_secrets에도 같이 기록한다.
export async function POST(request: Request) {
  const { userId } = await getSessionUser();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { password } = (await request.json().catch(() => ({}))) as { password?: string };

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  if (password) {
    await upsertAccountSecret(userId, password);
  }

  return Response.json({ ok: true });
}
