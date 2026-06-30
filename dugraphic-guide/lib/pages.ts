import { octokit, OWNER, REPO, PAGES_DIR } from "@/lib/github";
import type { PageData } from "@/lib/data";

export async function getPages(): Promise<PageData[]> {
  let entries;
  try {
    const { data } = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: PAGES_DIR,
    });
    entries = Array.isArray(data) ? data : [];
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return [];
    throw err;
  }

  const jsonFiles = entries.filter(
    (f) => f.type === "file" && f.name.endsWith(".json")
  );

  const pages = await Promise.all(
    jsonFiles.map(async (file) => {
      const { data } = await octokit.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path: file.path,
      });
      if (!("content" in data)) return null;
      const raw = Buffer.from(data.content, "base64").toString("utf-8");
      return JSON.parse(raw) as PageData;
    })
  );

  return pages.filter((p): p is PageData => p !== null);
}

export async function getPage(slug: string): Promise<PageData | undefined> {
  const path = `${PAGES_DIR}/${slug}.json`;
  // GitHub Contents API는 write 직후 일시적으로 404를 반환할 수 있어 재시도
  const delays = [500, 1000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      const { data } = await octokit.repos.getContent({ owner: OWNER, repo: REPO, path });
      if (!("content" in data)) return undefined;
      const raw = Buffer.from(data.content, "base64").toString("utf-8");
      return JSON.parse(raw) as PageData;
    } catch (err: unknown) {
      if ((err as { status?: number }).status !== 404) throw err;
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }
  return undefined;
}

export async function upsertPage(page: PageData): Promise<{ sha: string | undefined; path: string }> {
  const path = `${PAGES_DIR}/${page.slug}.json`;
  const content = Buffer.from(JSON.stringify(page, null, 2)).toString("base64");

  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path,
    });
    if ("sha" in data) sha = data.sha;
  } catch {
    // 없으면 신규 생성
  }

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path,
    message: sha ? `docs: update ${page.slug}` : `docs: create ${page.slug}`,
    content,
    ...(sha && { sha }),
  });

  return { sha: data.content?.sha, path };
}
