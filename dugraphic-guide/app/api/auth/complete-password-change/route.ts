import { getSessionUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase-admin";

// 강제 비밀번호 변경 화면에서, 새 비밀번호 설정(updateUser) 직후 호출된다.
// 대상 id는 클라이언트 입력이 아니라 서버에서 검증한 세션에서만 가져온다.
export async function POST() {
  const { userId } = await getSessionUser();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("profiles")
    .update({ must_change_password: false })
    .eq("id", userId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
