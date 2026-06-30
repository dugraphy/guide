import type { Metadata } from "next";
import Sidebar from "@/components/sidebar/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dugraphic Guide",
  description: "A Notion-like workspace for organizing your thoughts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="h-full flex">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
