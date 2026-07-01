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
  type: "text" | "select" | "date" | "json";
  options?: string[];
  questions?: string[];
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
        options: ["쇼핑몰", "병의원", "숙박업", "기업", "기타"],
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
  {
    name: "문의 클라이언트",
    slug: "inquiry-clients",
    columns: [
      { id: "업체명", name: "업체명", type: "text" },
      { id: "이름", name: "이름", type: "text" },
      { id: "연락처", name: "연락처", type: "text" },
      { id: "상담목적", name: "상담목적", type: "text" },
      {
        id: "업종",
        name: "업종",
        type: "select",
        options: ["쇼핑몰", "병의원", "숙박업", "기업", "기타"],
      },
      { id: "예산범위", name: "예산범위", type: "text" },
      { id: "희망기간", name: "희망기간", type: "text" },
      {
        id: "진행여부",
        name: "진행여부",
        type: "select",
        options: ["예정", "상담중", "완료", "보류"],
      },
      { id: "등록일", name: "등록일", type: "date" },
    ],
  },
  {
    name: "상담 체크리스트",
    slug: "checklist",
    columns: [
      { id: "업체명", name: "업체명", type: "text" },
      { id: "메모", name: "메모", type: "text" },
      {
        id: "업종",
        name: "업종",
        type: "select",
        options: ["병의원", "쇼핑몰", "숙박업", "기업", "기타"],
      },
      {
        id: "답변",
        name: "답변",
        type: "json",
        questions: [
          "현재 웹사이트 운영 여부",
          "원하는 제작물 종류",
          "선호 디자인 스타일",
          "참고 사이트 또는 레퍼런스",
          "예산 범위",
          "희망 완료 일정",
          "주요 타겟 고객층",
          "추가 요청 사항",
        ],
      },
      { id: "작성일", name: "작성일", type: "date" },
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

// Migrate "clients" rows that still use old industry values.
const OLD_CLIENT_INDUSTRIES = new Set(["디자인", "개발", "마케팅"]);

async function migrateClientsIndustry(clientsDbId: string) {
  const { data: rows } = await supabase
    .from("database_rows")
    .select("id, data")
    .eq("database_id", clientsDbId);

  const stale = (rows ?? []).filter((r) =>
    OLD_CLIENT_INDUSTRIES.has((r.data as Record<string, string>)["업종"] ?? "")
  );
  if (!stale.length) return;

  await Promise.all(
    stale.map((row) =>
      supabase
        .from("database_rows")
        .update({ data: { ...(row.data as Record<string, string>), 업종: "기타" } })
        .eq("id", row.id)
    )
  );
}

// Sync 메모 between "clients" and "checklist" when it changes on either side.
export async function syncMemoAcrossDBs(
  fromSlug: string,
  업체명: string,
  메모: string
): Promise<void> {
  if (!업체명 || (fromSlug !== "clients" && fromSlug !== "checklist")) return;
  const toSlug = fromSlug === "clients" ? "checklist" : "clients";

  const { data: targetDb } = await supabase
    .from("databases")
    .select("id")
    .eq("slug", toSlug)
    .single();
  if (!targetDb) return;

  const { data: allRows } = await supabase
    .from("database_rows")
    .select("id, data")
    .eq("database_id", targetDb.id);

  const matches = (allRows ?? []).filter(
    (r) => (r.data as Record<string, string>)["업체명"] === 업체명
  );
  if (!matches.length) return;

  // For checklist: pick the row with the most recent 작성일.
  const target =
    toSlug === "checklist" && matches.length > 1
      ? matches.reduce((best, r) => {
          const bd = (best.data as Record<string, string>)["작성일"] ?? "";
          const rd = (r.data as Record<string, string>)["작성일"] ?? "";
          return rd > bd ? r : best;
        })
      : matches[0];

  await supabase
    .from("database_rows")
    .update({ data: { ...(target.data as Record<string, string>), 메모 } })
    .eq("id", target.id);
}

// ── 공개 API ─────────────────────────────────────────────────────────────────

export async function getDatabases(): Promise<DatabaseDef[]> {
  const { data, error } = await supabase
    .from("databases")
    .select("id, name, slug, columns")
    .order("name");
  if (error) throw new Error(`getDatabases: ${error.message}`);

  const list = (data ?? []) as DatabaseDef[];
  const existingSlugs = new Set(list.map((d) => d.slug));
  const needsSeed = SEED_DATABASES.some((d) => !existingSlugs.has(d.slug));

  if (needsSeed) {
    await seedDatabases();
    const { data: seeded } = await supabase
      .from("databases")
      .select("id, name, slug, columns")
      .order("name");
    return (seeded ?? []) as DatabaseDef[];
  }

  // Auto-sync column schemas: when seed options differ from the DB, update and migrate.
  for (const seedDb of SEED_DATABASES) {
    const existing = list.find((d) => d.slug === seedDb.slug);
    if (!existing) continue;

    const seedOpts = JSON.stringify(
      Object.fromEntries(seedDb.columns.filter((c) => c.options).map((c) => [c.id, c.options]))
    );
    const existOpts = JSON.stringify(
      Object.fromEntries(existing.columns.filter((c) => c.options).map((c) => [c.id, c.options]))
    );
    if (seedOpts === existOpts) continue;

    await supabase.from("databases").update({ columns: seedDb.columns }).eq("slug", seedDb.slug);
    if (seedDb.slug === "clients") await migrateClientsIndustry(existing.id);
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
