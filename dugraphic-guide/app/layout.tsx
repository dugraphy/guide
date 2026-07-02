import type { Metadata } from "next";
import { headers } from "next/headers";
import Sidebar from "@/components/sidebar/Sidebar";
import { ToastContainer } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dugraphic Guide",
  description: "A Notion-like workspace for organizing your thoughts",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  // 강제 비밀번호 변경 화면에서는 사이드바(메뉴/데이터베이스 등 다른 콘텐츠)를 숨긴다.
  const hideSidebar = headersList.get("x-pathname") === "/force-password-change";

  return (
    <html lang="ko" className="h-full">
      <body className="h-full flex">
        {!hideSidebar && <Sidebar />}
        <main className="flex-1 overflow-y-auto">{children}</main>
        <ToastContainer />
      </body>
    </html>
  );
}
