import { getPage, upsertPage } from "@/lib/pages";
import dynamic from "next/dynamic";

// PageEditorWrapper uses dynamic imports internally — load it dynamically
// to prevent SSR issues with BlockNote
const PageEditorWrapper = dynamic(
  () => import("@/components/editor/PageEditorWrapper"),
  { ssr: false, loading: () => <div className="p-24 text-sm text-[var(--fg-muted)] animate-pulse">불러오는 중…</div> }
);

const HOME_PAGE = {
  slug: "home",
  title: "홈",
  icon: "🏠",
  description: "",
  body: "[]",
};

export default async function HomePage() {
  let page = await getPage("home");
  if (!page) {
    await upsertPage(HOME_PAGE);
    page = await getPage("home");
  }
  if (!page) return null;

  return <PageEditorWrapper page={page} />;
}
