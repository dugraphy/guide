import { requireOwnerOrForbidden } from "@/lib/auth";
import { createAccount } from "@/lib/admin-users";

export async function POST(request: Request) {
  const forbidden = await requireOwnerOrForbidden();
  if (forbidden) return forbidden;

  const { email, password } = (await request.json()) as {
    email?: string;
    password?: string;
  };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: "올바른 이메일을 입력해주세요." }, { status: 400 });
  }
  if (!password || password.length < 6) {
    return Response.json({ error: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
  }

  try {
    const user = await createAccount(email, password);
    return Response.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "계정 생성에 실패했습니다." },
      { status: 400 }
    );
  }
}
