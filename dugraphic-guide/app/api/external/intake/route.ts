import { getDatabase, addRow } from "@/lib/databases";

interface IntakeBody {
  업체명: string;
  담당자: string;
  연락처: string;
  업종: string;
  공통답변: Record<string, string>;
  업종별답변: Record<string, string>;
}

export async function POST(request: Request) {
  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey || apiKey !== process.env.EXTERNAL_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: IntakeBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { 업체명, 담당자, 연락처, 업종, 공통답변, 업종별답변 } = body;
  if (!업체명 || !업종) {
    return Response.json({ error: "업체명과 업종은 필수입니다" }, { status: 400 });
  }

  const [clientsDb, checklistDb] = await Promise.all([
    getDatabase("clients"),
    getDatabase("checklist"),
  ]);

  if (!clientsDb || !checklistDb) {
    return Response.json({ error: "데이터베이스를 찾을 수 없습니다" }, { status: 500 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const mergedAnswers = JSON.stringify({ ...공통답변, ...업종별답변 });

  try {
    const [clientRow, checklistRow] = await Promise.all([
      addRow(clientsDb.id, {
        업체명,
        업종,
        담당자: 담당자 ?? "",
        연락처: 연락처 ?? "",
        상태: "신규",
      }),
      addRow(checklistDb.id, {
        업체명,
        업종,
        답변: mergedAnswers,
        작성일: today,
      }),
    ]);

    return Response.json({ client: clientRow, checklist: checklistRow }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
