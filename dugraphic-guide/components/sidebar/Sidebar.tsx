import Link from "next/link";
import { FileText, Users, MessageCircleQuestion, ClipboardList, Receipt, Database } from "lucide-react";
import { getPages } from "@/lib/pages";
import { getDatabases, type DatabaseDef } from "@/lib/databases";
import { getSessionUser } from "@/lib/auth";
import SidebarItem from "./SidebarItem";
import SortablePagesList from "./SortablePagesList";
import SortableDatabasesList from "./SortableDatabasesList";
import NewPageButton from "./NewPageButton";
import AuthSection from "./AuthSection";
import SidebarShell from "./SidebarShell";
import CollapsedIconLink from "./CollapsedIconLink";

// 접힘 상태 사이드바 아이콘은 모두 이 크기/두께로 통일한다 (아이콘 종류는 항목마다 달라도 시각적 스타일은 동일하게)
const COLLAPSED_ICON_SIZE = 16;
const COLLAPSED_ICON_STROKE = 2;

const DATABASE_ICONS: Record<string, typeof Users> = {
  clients: Users,
  "inquiry-clients": MessageCircleQuestion,
  checklist: ClipboardList,
};

function databaseIcon(db: DatabaseDef) {
  const Icon = DATABASE_ICONS[db.slug] ?? Database;
  return <Icon size={COLLAPSED_ICON_SIZE} strokeWidth={COLLAPSED_ICON_STROKE} />;
}

export default async function Sidebar() {
  const [pages, databases, { email, role }] = await Promise.all([
    getPages(),
    getDatabases(),
    getSessionUser(),
  ]);

  return (
    <SidebarShell
      header={
        <Link href="/" className="inline-flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/img/logo.png" alt="Dugraphic Guide" className="h-8 w-auto" />
        </Link>
      }
      collapsedNav={
        <>
          {pages.map((page) => (
            <CollapsedIconLink
              key={page.slug}
              href={`/page/${page.slug}`}
              label={page.title}
              icon={<FileText size={COLLAPSED_ICON_SIZE} strokeWidth={COLLAPSED_ICON_STROKE} />}
            />
          ))}

          {role === "owner" && databases.length > 0 && (
            <>
              <div className="w-6 h-px bg-[var(--border)] my-1" />
              {databases.map((db) => (
                <CollapsedIconLink
                  key={db.slug}
                  href={`/db/${db.slug}`}
                  label={db.name}
                  icon={databaseIcon(db)}
                />
              ))}
            </>
          )}

          {role === "owner" && (
            <>
              <div className="w-6 h-px bg-[var(--border)] my-1" />
              <CollapsedIconLink
                href="/quotes"
                label="견적서 목록"
                icon={<Receipt size={COLLAPSED_ICON_SIZE} strokeWidth={COLLAPSED_ICON_STROKE} />}
              />
            </>
          )}
        </>
      }
    >
      <nav className="flex flex-col gap-0.5 px-1 py-2 flex-1">
        <div className="mt-4 mb-1 px-2">
          <span className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
            페이지
          </span>
        </div>

        <SortablePagesList pages={pages} canEdit={role === "owner"} />

        {role === "owner" && <NewPageButton />}

        {role === "owner" && databases.length > 0 && (
          <>
            <div className="mt-4 mb-1 px-2">
              <span className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
                데이터베이스
              </span>
            </div>
            <SortableDatabasesList databases={databases} canEdit={role === "owner"} />
          </>
        )}

        {role === "owner" && (
          <>
            <div className="mt-4 mb-1 px-2">
              <span className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
                견적서
              </span>
            </div>
            <SidebarItem href="/quotes" label="견적서 목록" />
          </>
        )}
      </nav>

      <AuthSection email={email} role={role} />
    </SidebarShell>
  );
}
