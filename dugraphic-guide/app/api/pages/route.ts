import { getPages, getPage, getNextPageSortOrder, upsertPage } from "@/lib/pages";
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

  // 새 페이지는 목록 맨 뒤에, 기존 페이지는 저장 때마다 순서가
  // 바뀌지 않도록 현재 sort_order를 그대로 유지한다.
  const existing = await getPage(page.slug);
  page.sortOrder = existing ? existing.sortOrder : await getNextPageSortOrder();

  const result = await upsertPage(page);
  return Response.json(result, { status: existing ? 200 : 201 });
}
