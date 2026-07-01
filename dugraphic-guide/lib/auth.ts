import { createClient } from "./supabase-server";

export type UserRole = "owner" | "member" | null;

export async function getSessionUser(): Promise<{
  userId: string | null;
  email: string | null;
  role: UserRole;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, email: null, role: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return {
    userId: user.id,
    email: user.email ?? null,
    role: (profile?.role ?? "member") as UserRole,
  };
}

export async function getCanEdit(): Promise<boolean> {
  const { role } = await getSessionUser();
  return role === "owner";
}

// Returns a 403 Response if the caller is not an owner, or null if allowed.
export async function requireOwnerOrForbidden(): Promise<Response | null> {
  const { role } = await getSessionUser();
  if (role !== "owner") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
