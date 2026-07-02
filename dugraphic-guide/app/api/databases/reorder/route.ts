import { reorderDatabases } from "@/lib/databases";
import { requireOwnerOrForbidden } from "@/lib/auth";

export async function PATCH(request: Request) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { slugs } = (await request.json()) as { slugs?: string[] };
  if (!Array.isArray(slugs) || slugs.some((s) => typeof s !== "string")) {
    return Response.json({ error: "slugs must be a string array" }, { status: 400 });
  }

  await reorderDatabases(slugs);
  return Response.json({ ok: true });
}
