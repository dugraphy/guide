import { after } from "next/server";
import { supabase, type PageRow } from "@/lib/supabase";
import { createAdminClient } from "@/lib/supabase-admin";
import { octokit, OWNER, REPO, PAGES_DIR } from "@/lib/github";
import type { PageData } from "@/lib/data";

// ── 변환 헬퍼 ──────────────────────────────────────────────────────────────

function rowToPage(row: PageRow): PageData {
  return {
    slug: row.slug,
    title: row.title,
    icon: row.body.icon ?? "📄",
    description: row.body.description ?? "",
    // blocks 배열을 다시 JSON 문자열로 — BlockEditor가 기대하는 형태
    body: JSON.stringify(row.body.blocks ?? []),
    sortOrder: row.sort_order,
  };
}

function pageToRow(page: PageData): PageRow {
  let blocks: unknown[] = [];
  try {
    const parsed = JSON.parse(page.body);
    if (Array.isArray(parsed)) blocks = parsed;
  } catch {
    // 기존 plain-text body는 빈 배열로 처리
  }
  return {
    slug: page.slug,
    title: page.title,
    body: { icon: page.icon, description: page.description, blocks },
    sort_order: page.sortOrder ?? null,
  };
}

// ── GitHub 백업 (실패해도 주요 흐름에 영향 없음) ───────────────────────────

async function backupToGitHub(page: PageData): Promise<string | undefined> {
  const path = `${PAGES_DIR}/${page.slug}.json`;
  const content = Buffer.from(JSON.stringify(page, null, 2)).toString("base64");
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path });
    if ("sha" in data) sha = data.sha;
  } catch {
    // 파일 없음 → 신규 생성
  }
  try {
    const { data } = await octokit.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path,
      message: sha ? `docs: update ${page.slug}` : `docs: create ${page.slug}`,
      content,
      ...(sha && { sha }),
    });
    return data.content?.sha;
  } catch (err) {
    console.error("[github-backup] failed for", page.slug, err);
    return undefined;
  }
}

// ── 공개 API ───────────────────────────────────────────────────────────────

export async function getPages(): Promise<PageData[]> {
  const { data, error } = await supabase
    .from("pages")
    .select("slug, title, body, sort_order")
    .neq("slug", "home") // home 페이지는 사이드바에 표시 안 함
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("title");
  if (error) throw new Error(`getPages: ${error.message}`);
  return (data as PageRow[]).map(rowToPage);
}

export async function getPage(slug: string): Promise<PageData | undefined> {
  const { data, error } = await supabase
    .from("pages")
    .select("slug, title, body, sort_order")
    .eq("slug", slug)
    .single();
  // PGRST116 = no rows — 정상적인 "없음" 케이스
  if (error) {
    if (error.code === "PGRST116") return undefined;
    throw new Error(`getPage(${slug}): ${error.message}`);
  }
  return rowToPage(data as PageRow);
}

// 신규 페이지가 목록 맨 뒤에 오도록, 현재 가장 큰 sort_order + 1을 반환한다.
export async function getNextPageSortOrder(): Promise<number> {
  const { data, error } = await supabase
    .from("pages")
    .select("sort_order")
    .order("sort_order", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getNextPageSortOrder: ${error.message}`);
  return (data?.sort_order ?? -1) + 1;
}

// orderedSlugs의 순서대로 sort_order(0, 1, 2, ...)를 일괄 반영한다.
// 쓰기 작업이므로 RLS(owner만 write 허용)를 우회하는 service role을 쓴다 —
// 호출자(API 라우트)가 이미 requireOwnerOrForbidden()으로 owner 여부를
// 확인했으므로 안전하다.
export async function reorderPages(orderedSlugs: string[]): Promise<void> {
  const supabaseAdmin = createAdminClient();
  const results = await Promise.all(
    orderedSlugs.map((slug, index) =>
      supabaseAdmin.from("pages").update({ sort_order: index }).eq("slug", slug)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw new Error(`reorderPages: ${failed.error.message}`);
}

export async function deletePage(slug: string): Promise<void> {
  // 1. Supabase 삭제 (primary) — service role: 위 reorderPages와 동일한 이유
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from("pages").delete().eq("slug", slug);
  if (error) throw new Error(`deletePage(${slug}): ${error.message}`);

  // 2. GitHub 백업 삭제 (secondary — 실패 시 로그만)
  const path = `${PAGES_DIR}/${slug}.json`;
  try {
    const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path });
    if ("sha" in data) {
      await octokit.repos.deleteFile({
        owner: OWNER,
        repo: REPO,
        path,
        message: `docs: delete ${slug}`,
        sha: data.sha,
      });
    }
  } catch (err) {
    console.error("[github-backup] delete failed for", slug, err);
  }
}

export async function upsertPage(page: PageData): Promise<{ path: string }> {
  const path = `${PAGES_DIR}/${page.slug}.json`;

  // 1. Supabase upsert (primary store) — service role, see reorderPages 주석
  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin
    .from("pages")
    .upsert(pageToRow(page), { onConflict: "slug" });
  if (error) throw new Error(`upsertPage(${page.slug}): ${error.message}`);

  // 2. GitHub 백업 (secondary — 실패 시 로그만 남김). 큰 표를 편집할 때는
  // 자동저장이 몇 초마다 반복되는데, 그때마다 GitHub API 왕복(수백ms~)까지
  // 응답을 막고 기다리면 저장 주기가 그만큼 늘어진다. 클라이언트는 이
  // 반환값(sha/path)을 쓰지 않으므로 응답 이후로 미뤄도 안전하다.
  after(() => backupToGitHub(page));

  return { path };
}
