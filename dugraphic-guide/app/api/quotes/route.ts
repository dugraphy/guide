import { getQuotes, createQuote, deleteQuotes } from "@/lib/quotes";
import { requireOwnerOrForbidden } from "@/lib/auth";
import type { NewQuote } from "@/lib/quotes";

export async function GET() {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const quotes = await getQuotes();
  return Response.json(quotes);
}

export async function POST(request: Request) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const quote = (await request.json()) as NewQuote;

  if (!quote.clientName || !quote.quoteDate || !quote.quoteType) {
    return Response.json(
      { error: "clientName, quoteDate, quoteType are required" },
      { status: 400 }
    );
  }

  const created = await createQuote(quote);
  return Response.json(created, { status: 201 });
}

export async function DELETE(request: Request) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { ids } = (await request.json()) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: "ids is required" }, { status: 400 });
  }

  await deleteQuotes(ids);
  return new Response(null, { status: 204 });
}
