import type { Metadata } from "next";
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
      <body className="h-full">{children}</body>
    </html>
  );
}
