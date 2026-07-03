import { getBusinessProfile, updateBusinessProfile } from "@/lib/businessProfile";
import { requireOwnerOrForbidden } from "@/lib/auth";
import type { BusinessProfile } from "@/lib/businessProfile";

export async function GET() {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const profile = await getBusinessProfile();
  return Response.json(profile);
}

export async function PUT(request: Request) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const profile = (await request.json()) as BusinessProfile;
  await updateBusinessProfile(profile);
  return Response.json({ ok: true });
}
