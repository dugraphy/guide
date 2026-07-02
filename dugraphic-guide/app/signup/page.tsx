import { redirect } from "next/navigation";

// Public signup is disabled — accounts are created by the owner from /admin.
export default function SignupPage() {
  redirect("/login");
}
