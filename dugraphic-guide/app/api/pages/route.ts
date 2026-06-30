import { octokit, OWNER, REPO, PAGES_DIR } from "@/lib/github";
import type { PageData } from "@/lib/data";

// GET /api/pages — repo의 pages/*.json 목록 + 내용 반환
export async function GET() {
  let entries;
  try {
    const { data } = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path: PAGES_DIR,
    });
    entries = Array.isArray(data) ? data : [];
  } catch (err: unknown) {
    // pages/ 디렉토리가 아직 없으면 빈 배열 반환
    if ((err as { status?: number }).status === 404) {
      return Response.json([]);
    }
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

  return Response.json(pages.filter(Boolean));
}

// POST /api/pages — 페이지 생성 또는 수정
// body: PageData (slug 필수)
export async function POST(request: Request) {
  const page = (await request.json()) as PageData;

  if (!page.slug) {
    return Response.json({ error: "slug is required" }, { status: 400 });
  }

  const path = `${PAGES_DIR}/${page.slug}.json`;
  const content = Buffer.from(JSON.stringify(page, null, 2)).toString("base64");

  // 기존 파일의 SHA 조회 (수정 시 필요)
  let sha: string | undefined;
  try {
    const { data } = await octokit.repos.getContent({
      owner: OWNER,
      repo: REPO,
      path,
    });
    if ("sha" in data) sha = data.sha;
  } catch {
    // 파일이 없으면 신규 생성
  }

  const { data } = await octokit.repos.createOrUpdateFileContents({
    owner: OWNER,
    repo: REPO,
    path,
    message: sha ? `docs: update ${page.slug}` : `docs: create ${page.slug}`,
    content,
    ...(sha && { sha }),
  });

  return Response.json(
    { sha: data.content?.sha, path },
    { status: sha ? 200 : 201 }
  );
}
