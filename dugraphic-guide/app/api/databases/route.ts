import { getDatabases } from "@/lib/databases";
import { supabase } from "@/lib/supabase";
import type { Column } from "@/lib/databases";

export async function GET() {
  return Response.json(await getDatabases());
}

export async function POST(request: Request) {
  const { name, slug, columns } = (await request.json()) as {
    name: string;
    slug: string;
    columns: Column[];
  };
  const { data, error } = await supabase
    .from("databases")
    .insert({ name, slug, columns })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json(data, { status: 201 });
}
