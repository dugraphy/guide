import { supabase, type PageRow } from "@/lib/supabase";
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
    .select("slug, title, body")
    .neq("slug", "home") // home 페이지는 사이드바에 표시 안 함
    .order("title");
  if (error) throw new Error(`getPages: ${error.message}`);
  return (data as PageRow[]).map(rowToPage);
}

export async function getPage(slug: string): Promise<PageData | undefined> {
  const { data, error } = await supabase
    .from("pages")
    .select("slug, title, body")
    .eq("slug", slug)
    .single();
  // PGRST116 = no rows — 정상적인 "없음" 케이스
  if (error) {
    if (error.code === "PGRST116") return undefined;
    throw new Error(`getPage(${slug}): ${error.message}`);
  }
  return rowToPage(data as PageRow);
}

export async function deletePage(slug: string): Promise<void> {
  // 1. Supabase 삭제 (primary)
  const { error } = await supabase.from("pages").delete().eq("slug", slug);
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

export async function upsertPage(
  page: PageData
): Promise<{ sha: string | undefined; path: string }> {
  const path = `${PAGES_DIR}/${page.slug}.json`;

  // 1. Supabase upsert (primary store)
  const { error } = await supabase
    .from("pages")
    .upsert(pageToRow(page), { onConflict: "slug" });
  if (error) throw new Error(`upsertPage(${page.slug}): ${error.message}`);

  // 2. GitHub 백업 (secondary — 실패 시 로그만 남김)
  const sha = await backupToGitHub(page);

  return { sha, path };
}
