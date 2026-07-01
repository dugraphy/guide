import { deletePage } from "@/lib/pages";
import { requireOwnerOrForbidden } from "@/lib/auth";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { slug } = await params;
  await deletePage(slug);
  return new Response(null, { status: 204 });
}
