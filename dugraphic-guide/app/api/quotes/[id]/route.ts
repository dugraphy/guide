import { updateQuote, deleteQuote } from "@/lib/quotes";
import { requireOwnerOrForbidden } from "@/lib/auth";
import type { NewQuote } from "@/lib/quotes";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { id } = await params;
  const quote = (await request.json()) as NewQuote;

  if (!quote.clientName || !quote.quoteDate || !quote.quoteType) {
    return Response.json(
      { error: "clientName, quoteDate, quoteType are required" },
      { status: 400 }
    );
  }

  const updated = await updateQuote(id, quote);
  return Response.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { id } = await params;
  await deleteQuote(id);
  return new Response(null, { status: 204 });
}
