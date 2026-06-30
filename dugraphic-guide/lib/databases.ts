/*
 * Supabase SQL — 처음 한 번 SQL 편집기에서 실행:
 *
 * create table if not exists databases (
 *   id         uuid primary key default gen_random_uuid(),
 *   name       text not null,
 *   slug       text unique not null,
 *   columns    jsonb not null default '[]'::jsonb
 * );
 *
 * create table if not exists database_rows (
 *   id          uuid primary key default gen_random_uuid(),
 *   database_id uuid not null references databases(id) on delete cascade,
 *   data        jsonb not null default '{}'::jsonb,
 *   created_at  timestamptz not null default now()
 * );
 *
 * create index if not exists idx_db_rows_database_id
 *   on database_rows(database_id);
 *
 * alter table databases enable row level security;
 * alter table database_rows enable row level security;
 * create policy "public_all_databases"
 *   on databases for all using (true) with check (true);
 * create policy "public_all_database_rows"
 *   on database_rows for all using (true) with check (true);
 */

import { supabase } from "@/lib/supabase";

export interface Column {
  id: string;
  name: string;
  type: "text" | "select" | "date";
  options?: string[];
}

export interface DatabaseDef {
  id: string;
  name: string;
  slug: string;
  columns: Column[];
}

export interface DatabaseRow {
  id: string;
  database_id: string;
  data: Record<string, string>;
  created_at: string;
}

// ── 초기 데이터 ──────────────────────────────────────────────────────────────

const SEED_DATABASES: Array<Omit<DatabaseDef, "id">> = [
  {
    name: "업체 관리",
    slug: "clients",
    columns: [
      { id: "업체명", name: "업체명", type: "text" },
      {
        id: "업종",
        name: "업종",
        type: "select",
        options: ["디자인", "개발", "마케팅", "기타"],
      },
      { id: "담당자", name: "담당자", type: "text" },
      { id: "연락처", name: "연락처", type: "text" },
      { id: "진행 일자", name: "진행 일자", type: "date" },
      { id: "마감 일자", name: "마감 일자", type: "date" },
      {
        id: "상태",
        name: "상태",
        type: "select",
        options: ["신규", "진행중", "완료"],
      },
      { id: "메모", name: "메모", type: "text" },
    ],
  },
];

async function seedDatabases() {
  for (const db of SEED_DATABASES) {
    await supabase
      .from("databases")
      .upsert(
        { name: db.name, slug: db.slug, columns: db.columns },
        { onConflict: "slug", ignoreDuplicates: true }
      );
  }
}

// ── 공개 API ─────────────────────────────────────────────────────────────────

export async function getDatabases(): Promise<DatabaseDef[]> {
  const { data, error } = await supabase
    .from("databases")
    .select("id, name, slug, columns")
    .order("name");
  if (error) throw new Error(`getDatabases: ${error.message}`);

  const list = (data ?? []) as DatabaseDef[];
  if (list.length === 0) {
    await seedDatabases();
    const { data: seeded } = await supabase
      .from("databases")
      .select("id, name, slug, columns")
      .order("name");
    return (seeded ?? []) as DatabaseDef[];
  }
  return list;
}

export async function getDatabase(slug: string): Promise<DatabaseDef | undefined> {
  const { data, error } = await supabase
    .from("databases")
    .select("id, name, slug, columns")
    .eq("slug", slug)
    .single();
  if (error) {
    if (error.code === "PGRST116") return undefined;
    throw new Error(`getDatabase(${slug}): ${error.message}`);
  }
  return data as DatabaseDef;
}

export async function getRows(databaseId: string): Promise<DatabaseRow[]> {
  const { data, error } = await supabase
    .from("database_rows")
    .select("id, database_id, data, created_at")
    .eq("database_id", databaseId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getRows: ${error.message}`);
  return (data ?? []) as DatabaseRow[];
}

export async function addRow(
  databaseId: string,
  data: Record<string, string>
): Promise<DatabaseRow> {
  const { data: row, error } = await supabase
    .from("database_rows")
    .insert({ database_id: databaseId, data })
    .select()
    .single();
  if (error) throw new Error(`addRow: ${error.message}`);
  return row as DatabaseRow;
}

export async function updateRow(
  id: string,
  data: Record<string, string>
): Promise<DatabaseRow> {
  const { data: row, error } = await supabase
    .from("database_rows")
    .update({ data })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateRow: ${error.message}`);
  return row as DatabaseRow;
}

export async function deleteRow(id: string): Promise<void> {
  const { error } = await supabase.from("database_rows").delete().eq("id", id);
  if (error) throw new Error(`deleteRow: ${error.message}`);
}
