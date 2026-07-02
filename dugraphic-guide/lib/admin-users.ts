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

// 초대 이메일을 발송하고, 계정은 auth.users insert 트리거(handle_new_user)가
// profiles 테이블에 role="member"로 자동 등록한다.
export async function inviteAccount(email: string, redirectTo: string) {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
  });
  if (error) throw new Error(error.message);
  return data.user;
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
