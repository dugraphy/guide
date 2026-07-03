import { getTemplates } from "@/lib/templates";

export async function GET() {
  const templates = await getTemplates();
  return Response.json(templates);
}
