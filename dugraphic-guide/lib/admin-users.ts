import { createAdminClient } from "@/lib/supabase-admin";
import type { UserRole } from "@/lib/auth";

export interface AccountRow {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export async function getAccounts(): Promise<AccountRow[]> {
  const supabaseAdmin = createAdminClient();

  const [{ data: usersData, error: usersError }, { data: profiles, error: profilesError }] =
    await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin.from("profiles").select("id, role"),
    ]);

  if (usersError) throw new Error(`getAccounts: ${usersError.message}`);
  if (profilesError) throw new Error(`getAccounts: ${profilesError.message}`);

  const roleById = new Map((profiles ?? []).map((p) => [p.id, p.role as UserRole]));

  return usersData.users
    .map((u) => ({
      id: u.id,
      email: u.email ?? "",
      role: roleById.get(u.id) ?? "member",
      createdAt: u.created_at,
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// email_confirm: true로 이메일 발송 없이 즉시 로그인 가능한 계정을 만든다.
// profiles 행은 auth.users insert 트리거(handle_new_user)가 role="member"로
// 자동 등록한다. 관리자가 정한 비밀번호이므로 최초 로그인 시 반드시
// 새 비밀번호로 바꾸도록 must_change_password를 명시적으로 true로 설정한다.
//
// account_secrets에 같은 비밀번호를 평문으로도 저장한다 — /admin에서 owner가
// 나중에 다시 확인할 수 있게 하기 위한 것으로, 보안상 권장되는 방식은 아니지만
// 계정 수가 적은 지금 단계에서 임시로 쓰기로 한 결정이다(추후 재설정 링크
// 방식으로 교체 예정).
export async function createAccount(email: string, password: string) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ must_change_password: true })
    .eq("id", data.user.id);
  if (profileError) throw new Error(profileError.message);

  const { error: secretError } = await supabaseAdmin
    .from("account_secrets")
    .upsert({ user_id: data.user.id, password_plain: password, updated_at: new Date().toISOString() });
  if (secretError) throw new Error(secretError.message);

  return data.user;
}

export async function getAccountPassword(id: string): Promise<string> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("account_secrets")
    .select("password_plain")
    .eq("user_id", id)
    .single();
  if (error) throw new Error(`getAccountPassword(${id}): ${error.message}`);
  return data.password_plain;
}

export async function updateAccountRole(id: string, role: "owner" | "member") {
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from("profiles").update({ role }).eq("id", id);
  if (error) throw new Error(`updateAccountRole(${id}): ${error.message}`);
}

// auth.users 삭제 시 profiles 행은 FK on delete cascade로 함께 삭제된다.
export async function deleteAccount(id: string) {
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
  if (error) throw new Error(`deleteAccount(${id}): ${error.message}`);
}
