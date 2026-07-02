import { requireOwnerOrForbidden } from "@/lib/auth";
import { inviteAccount } from "@/lib/admin-users";

export async function POST(request: Request) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { email } = (await request.json()) as { email?: string };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "올바른 이메일을 입력해주세요." }, { status: 400 });
  }

  const origin = new URL(request.url).origin;
  try {
    const user = await inviteAccount(email, `${origin}/set-password`);
    return Response.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "초대 발송에 실패했습니다." },
      { status: 400 }
    );
  }
}
