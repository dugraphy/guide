import { getPage, upsertPage } from "@/lib/pages";
import { getCanEdit } from "@/lib/auth";
import PageEditorWrapper from "@/components/editor/PageEditorWrapper";

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

  const canEdit = await getCanEdit();
  return <PageEditorWrapper page={page} canEdit={canEdit} />;
}
