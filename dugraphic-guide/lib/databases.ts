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
 * RLS policies: see supabase/rls-hardening.sql (read for everyone,
 * write for owners only — enforced there, not with an open "for all" policy).
 */

import { supabase } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";

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
  sort_order: number | null;
}

export interface DatabaseRow {
  id: string;
  database_id: string;
  data: Record<string, string>;
  created_at: string;
}

// ── 초기 데이터 ──────────────────────────────────────────────────────────────

const SEED_DATABASES: Array<Omit<DatabaseDef, "id" | "sort_order">> = [
  {
    name: "클라이언트 관리",
    slug: "clients",
    columns: [
      { id: "업체명", name: "클라이언트명", type: "text" },
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
        options: ["예정", "상담중", "작업중", "완료", "보류"],
      },
      { id: "메모", name: "메모", type: "text" },
    ],
  },
  {
    name: "문의 클라이언트",
    slug: "inquiry-clients",
    columns: [
      { id: "업체명", name: "클라이언트명", type: "text" },
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
        options: ["예정", "상담중", "작업중", "완료", "보류"],
      },
      { id: "등록일", name: "등록일", type: "date" },
    ],
  },
  {
    name: "상담 체크리스트",
    slug: "checklist",
    columns: [
      { id: "업체명", name: "클라이언트명", type: "text" },
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

// 하드코딩된 시드 데이터를 쓰는 것뿐이라 service role로 진행해도 안전하다
// (RLS는 owner 권한이 있는 세션만 쓰기를 허용하는데, 이 함수는 로그인
// 세션과 무관하게 앱 초기화 시점에 항상 실행되어야 하기 때문).
async function seedDatabases() {
  const supabaseAdmin = createAdminClient();
  for (const [index, db] of SEED_DATABASES.entries()) {
    await supabaseAdmin
      .from("databases")
      .upsert(
        { name: db.name, slug: db.slug, columns: db.columns, sort_order: index },
        { onConflict: "slug", ignoreDuplicates: true }
      );
  }
}

// Migrate "clients" rows that still use old industry values.
const OLD_CLIENT_INDUSTRIES = new Set(["디자인", "개발", "마케팅"]);

async function migrateClientsIndustry(clientsDbId: string) {
  const supabaseAdmin = createAdminClient();
  const { data: rows } = await supabaseAdmin
    .from("database_rows")
    .select("id, data")
    .eq("database_id", clientsDbId);

  const stale = (rows ?? []).filter((r) =>
    OLD_CLIENT_INDUSTRIES.has((r.data as Record<string, string>)["업종"] ?? "")
  );
  if (!stale.length) return;

  await Promise.all(
    stale.map((row) =>
      supabaseAdmin
        .from("database_rows")
        .update({ data: { ...(row.data as Record<string, string>), 업종: "기타" } })
        .eq("id", row.id)
    )
  );
}

// Migrate "clients" rows from the old 상태 vocabulary (신규/진행중) to the
// new one shared with "문의 클라이언트"의 진행여부 (예정/상담중/작업중/완료/보류).
const OLD_CLIENT_STATUS_MAP: Record<string, string> = {
  신규: "예정",
  진행중: "작업중",
};

async function migrateClientsStatus(clientsDbId: string) {
  const supabaseAdmin = createAdminClient();
  const { data: rows } = await supabaseAdmin
    .from("database_rows")
    .select("id, data")
    .eq("database_id", clientsDbId);

  const stale = (rows ?? []).filter(
    (r) => (r.data as Record<string, string>)["상태"] in OLD_CLIENT_STATUS_MAP
  );
  if (!stale.length) return;

  await Promise.all(
    stale.map((row) => {
      const oldStatus = (row.data as Record<string, string>)["상태"];
      return supabaseAdmin
        .from("database_rows")
        .update({
          data: { ...(row.data as Record<string, string>), 상태: OLD_CLIENT_STATUS_MAP[oldStatus] },
        })
        .eq("id", row.id);
    })
  );
}

// Sync 메모 between "clients" and "checklist" when it changes on either side.
// 호출자(app/api/databases/[slug]/rows/[id]/route.ts PATCH)가 이미
// requireOwnerOrForbidden()으로 owner 여부를 확인했으므로 service role 사용.
export async function syncMemoAcrossDBs(
  fromSlug: string,
  업체명: string,
  메모: string
): Promise<void> {
  if (!업체명 || (fromSlug !== "clients" && fromSlug !== "checklist")) return;
  const toSlug = fromSlug === "clients" ? "checklist" : "clients";
  const supabaseAdmin = createAdminClient();

  const { data: targetDb } = await supabaseAdmin
    .from("databases")
    .select("id")
    .eq("slug", toSlug)
    .single();
  if (!targetDb) return;

  const { data: allRows } = await supabaseAdmin
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

  await supabaseAdmin
    .from("database_rows")
    .update({ data: { ...(target.data as Record<string, string>), 메모 } })
    .eq("id", target.id);
}

// "clients"의 상태 ↔ "inquiry-clients"의 진행여부를 업체명 기준으로 동기화.
// 두 테이블의 컬럼 id가 다르므로(상태 vs 진행여부) 대상 필드를 매핑해서 쓴다.
const STATUS_FIELD_BY_SLUG: Record<string, string> = {
  clients: "상태",
  "inquiry-clients": "진행여부",
};

export async function syncStatusAcrossDBs(
  fromSlug: string,
  업체명: string,
  status: string
): Promise<void> {
  if (!업체명 || (fromSlug !== "clients" && fromSlug !== "inquiry-clients")) return;
  const toSlug = fromSlug === "clients" ? "inquiry-clients" : "clients";
  const toField = STATUS_FIELD_BY_SLUG[toSlug];
  const supabaseAdmin = createAdminClient();

  const { data: targetDb } = await supabaseAdmin
    .from("databases")
    .select("id")
    .eq("slug", toSlug)
    .single();
  if (!targetDb) return;

  const { data: allRows } = await supabaseAdmin
    .from("database_rows")
    .select("id, data")
    .eq("database_id", targetDb.id);

  const matches = (allRows ?? []).filter(
    (r) => (r.data as Record<string, string>)["업체명"] === 업체명
  );
  if (!matches.length) return;

  // inquiry-clients에 같은 업체명이 여러 건이면 등록일이 가장 최근인 행을 기준으로.
  const target =
    toSlug === "inquiry-clients" && matches.length > 1
      ? matches.reduce((best, r) => {
          const bd = (best.data as Record<string, string>)["등록일"] ?? "";
          const rd = (r.data as Record<string, string>)["등록일"] ?? "";
          return rd > bd ? r : best;
        })
      : matches[0];

  await supabaseAdmin
    .from("database_rows")
    .update({ data: { ...(target.data as Record<string, string>), [toField]: status } })
    .eq("id", target.id);
}

// ── 공개 API ─────────────────────────────────────────────────────────────────

export async function getDatabases(): Promise<DatabaseDef[]> {
  const { data, error } = await supabase
    .from("databases")
    .select("id, name, slug, columns, sort_order")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name");
  if (error) throw new Error(`getDatabases: ${error.message}`);

  const list = (data ?? []) as DatabaseDef[];
  const existingSlugs = new Set(list.map((d) => d.slug));
  const needsSeed = SEED_DATABASES.some((d) => !existingSlugs.has(d.slug));

  if (needsSeed) {
    await seedDatabases();
    const { data: seeded } = await supabase
      .from("databases")
      .select("id, name, slug, columns, sort_order")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name");
    return (seeded ?? []) as DatabaseDef[];
  }

  // Auto-sync column schemas: when seed options differ from the DB, update and migrate.
  const supabaseAdmin = createAdminClient();
  for (const seedDb of SEED_DATABASES) {
    const existing = list.find((d) => d.slug === seedDb.slug);
    if (!existing) continue;

    const colKey = (cols: Column[]) =>
      JSON.stringify(cols.map((c) => ({ id: c.id, name: c.name, options: c.options ?? null })));
    const nameChanged = seedDb.name !== existing.name;
    const colsChanged = colKey(seedDb.columns) !== colKey(existing.columns);
    if (!nameChanged && !colsChanged) continue;

    const patch: Record<string, unknown> = {};
    if (nameChanged) patch.name = seedDb.name;
    if (colsChanged) patch.columns = seedDb.columns;
    await supabaseAdmin.from("databases").update(patch).eq("slug", seedDb.slug);
    if (colsChanged && seedDb.slug === "clients") {
      await migrateClientsIndustry(existing.id);
      await migrateClientsStatus(existing.id);
    }
  }

  return list;
}

export async function getDatabase(slug: string): Promise<DatabaseDef | undefined> {
  const { data, error } = await supabase
    .from("databases")
    .select("id, name, slug, columns, sort_order")
    .eq("slug", slug)
    .single();
  if (error) {
    if (error.code === "PGRST116") return undefined;
    throw new Error(`getDatabase(${slug}): ${error.message}`);
  }
  return data as DatabaseDef;
}

// orderedSlugs의 순서대로 sort_order(0, 1, 2, ...)를 일괄 반영한다.
// service role 사용 이유는 reorderPages(lib/pages.ts)와 동일.
export async function reorderDatabases(orderedSlugs: string[]): Promise<void> {
  const supabaseAdmin = createAdminClient();
  const results = await Promise.all(
    orderedSlugs.map((slug, index) =>
      supabaseAdmin.from("databases").update({ sort_order: index }).eq("slug", slug)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`reorderDatabases: ${failed.error.message}`);
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

// addRow/updateRow/deleteRow는 owner 전용 쓰기 API 라우트(및 X-API-Key로
// 별도 인증되는 외부 연동 라우트)에서만 호출되므로 service role을 쓴다.
export async function addRow(
  databaseId: string,
  data: Record<string, string>
): Promise<DatabaseRow> {
  const supabaseAdmin = createAdminClient();
  const { data: row, error } = await supabaseAdmin
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
  const supabaseAdmin = createAdminClient();
  const { data: row, error } = await supabaseAdmin
    .from("database_rows")
    .update({ data })
    .eq("id", id)
    .select()
    .single();
  if (error) throw new Error(`updateRow: ${error.message}`);
  return row as DatabaseRow;
}

export async function deleteRow(id: string): Promise<void> {
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from("database_rows").delete().eq("id", id);
  if (error) throw new Error(`deleteRow: ${error.message}`);
}
