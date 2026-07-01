import { getPages, upsertPage } from "@/lib/pages";
import { requireOwnerOrForbidden } from "@/lib/auth";
import type { PageData } from "@/lib/data";

export async function GET() {
  const pages = await getPages();
  return Response.json(pages);
}

export async function POST(request: Request) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const page = (await request.json()) as PageData;

  if (!page.slug) {
    return Response.json({ error: "slug is required" }, { status: 400 });
  }

  const result = await upsertPage(page);
  return Response.json(result, { status: result.sha ? 200 : 201 });
}
