import { getDatabase, addRow } from "@/lib/databases";

const VALID_INDUSTRIES = new Set(["쇼핑몰", "병의원", "숙박업", "기업"]);

export async function POST(request: Request) {
  const apiKey = request.headers.get("X-API-Key");
  if (!apiKey || apiKey !== process.env.EXTERNAL_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const 업체명 = body["업체명"] ?? "";
  if (!업체명) {
    return Response.json({ error: "업체명은 필수입니다" }, { status: 400 });
  }

  const 이름 = body["이름"] ?? "";
  const 연락처 = body["연락처"] ?? "";
  const 상담목적 = body["상담 목적"] ?? "";
  const rawIndustry = body["업종"] ?? "";
  const 예산범위 = body["예산 범위"] ?? "";
  const 희망기간 = body["희망 기간"] ?? "";

  const 업종 = VALID_INDUSTRIES.has(rawIndustry) ? rawIndustry : "기타";
  const 등록일 = new Date().toISOString().slice(0, 10);

  const db = await getDatabase("inquiry-clients");
  if (!db) {
    return Response.json({ error: "inquiry-clients DB를 찾을 수 없습니다" }, { status: 500 });
  }

  try {
    const row = await addRow(db.id, {
      업체명,
      이름,
      연락처,
      상담목적,
      업종,
      예산범위,
      희망기간,
      진행여부: "예정",
      등록일,
    });
    return Response.json(row, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
}
