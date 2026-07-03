/*
 * Supabase SQL — see supabase/quotes.sql for the full create-table + RLS.
 *
 * create table if not exists quotes (
 *   id           uuid primary key default gen_random_uuid(),
 *   client_name  text not null,
 *   quote_date   date not null,
 *   quote_type   text not null check (quote_type in ('리뉴얼', '신규')),
 *   items        jsonb not null default '[]'::jsonb,  -- QuoteItem[]
 *   deposit_rate numeric not null default 30,
 *   notes        text not null default '',
 *   vat_included boolean not null default false,
 *   created_at   timestamptz not null default now()
 * );
 *
 * Owner-only read/write via RLS (see supabase/quotes.sql). This module
 * always uses the service-role admin client — callers (page.tsx / API
 * routes) must check requireOwnerOrForbidden()/getSessionUser() first.
 */

import { createAdminClient } from "@/lib/supabase-admin";

export type QuoteType = "리뉴얼" | "신규";

export interface QuoteItem {
  name: string;
  unitPrice: number;
  discountPrice: number;
  qty: number;
  note: string;
}

export interface QuoteRow {
  id: string;
  clientName: string;
  quoteDate: string;
  quoteType: QuoteType;
  items: QuoteItem[];
  depositRate: number;
  notes: string;
  vatIncluded: boolean;
  createdAt: string;
}

export interface NewQuote {
  clientName: string;
  quoteDate: string;
  quoteType: QuoteType;
  items: QuoteItem[];
  depositRate: number;
  notes: string;
  vatIncluded: boolean;
}

const QUOTE_COLUMNS =
  "id, client_name, quote_date, quote_type, items, deposit_rate, notes, vat_included, created_at";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToQuote(row: any): QuoteRow {
  return {
    id: row.id,
    clientName: row.client_name,
    quoteDate: row.quote_date,
    quoteType: row.quote_type,
    items: row.items ?? [],
    depositRate: row.deposit_rate,
    notes: row.notes,
    vatIncluded: row.vat_included,
    createdAt: row.created_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function quoteToRow(quote: NewQuote): Record<string, any> {
  return {
    client_name: quote.clientName,
    quote_date: quote.quoteDate,
    quote_type: quote.quoteType,
    items: quote.items,
    deposit_rate: quote.depositRate,
    notes: quote.notes,
    vat_included: quote.vatIncluded,
  };
}

export async function getQuotes(): Promise<QuoteRow[]> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`getQuotes: ${error.message}`);
  return data.map(rowToQuote);
}

export async function getQuoteById(id: string): Promise<QuoteRow | undefined> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("quotes")
    .select(QUOTE_COLUMNS)
    .eq("id", id)
    .single();
  if (error) {
    if (error.code === "PGRST116") return undefined;
    throw new Error(`getQuoteById(${id}): ${error.message}`);
  }
  return rowToQuote(data);
}

export async function createQuote(quote: NewQuote): Promise<QuoteRow> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("quotes")
    .insert(quoteToRow(quote))
    .select(QUOTE_COLUMNS)
    .single();
  if (error) throw new Error(`createQuote: ${error.message}`);
  return rowToQuote(data);
}

export async function updateQuote(id: string, quote: NewQuote): Promise<QuoteRow> {
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin
    .from("quotes")
    .update(quoteToRow(quote))
    .eq("id", id)
    .select(QUOTE_COLUMNS)
    .single();
  if (error) throw new Error(`updateQuote(${id}): ${error.message}`);
  return rowToQuote(data);
}

export async function deleteQuote(id: string): Promise<void> {
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from("quotes").delete().eq("id", id);
  if (error) throw new Error(`deleteQuote(${id}): ${error.message}`);
}
