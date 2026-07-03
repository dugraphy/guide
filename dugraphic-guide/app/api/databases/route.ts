import { getDatabases } from "@/lib/databases";
import { createAdminClient } from "@/lib/supabase-admin";
import { requireOwnerOrForbidden } from "@/lib/auth";
import type { Column } from "@/lib/databases";

export async function GET() {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  return Response.json(await getDatabases());
}

export async function POST(request: Request) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { name, slug, columns } = (await request.json()) as {
    name: string;
    slug: string;
    columns: Column[];
  };
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("databases")
    .insert({ name, slug, columns })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data, { status: 201 });
}
