import { deletePage } from "@/lib/pages";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  await deletePage(slug);
  return new Response(null, { status: 204 });
}
