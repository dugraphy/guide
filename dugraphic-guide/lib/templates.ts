/*
 * Supabase SQL — see supabase/templates.sql for the full create-table + RLS
 * + seed script (create it there, don't re-paste it here):
 *
 * create table if not exists templates (
 *   id         uuid primary key default gen_random_uuid(),
 *   name       text unique not null,
 *   icon       text not null default '📄',
 *   blocks     jsonb not null default '[]'::jsonb,
 *   sort_order integer not null default 0,
 *   created_at timestamptz not null default now()
 * );
 *
 * RLS policies: read for everyone, write for owners only (see
 * supabase/templates.sql, reusing public.is_owner()).
 */

import { supabase } from "@/lib/supabase";

// Supabase templates 테이블 로우 타입. `blocks`는 BlockNote PartialBlock[]
// JSON — 슬래시 메뉴에서 템플릿을 선택하면 그대로 커서 위치에 삽입된다.
export interface TemplateRow {
  id: string;
  name: string;
  icon: string;
  blocks: unknown[];
  sort_order: number;
}

export async function getTemplates(): Promise<TemplateRow[]> {
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, icon, blocks, sort_order")
    .order("sort_order", { ascending: true });
  if (error) throw new Error(`getTemplates: ${error.message}`);
  return data as TemplateRow[];
}
