import { getPages } from "@/lib/pages";
import { getDatabases } from "@/lib/databases";
import { getSessionUser } from "@/lib/auth";
import SidebarItem from "./SidebarItem";
import SortablePagesList from "./SortablePagesList";
import SortableDatabasesList from "./SortableDatabasesList";
import NewPageButton from "./NewPageButton";
import NewQuoteButton from "./NewQuoteButton";
import AuthSection from "./AuthSection";

const NAV_ITEMS = [
  { href: "/", label: "홈" },
];

export default async function Sidebar() {
  const [pages, databases, { email, role }] = await Promise.all([
    getPages(),
    getDatabases(),
    getSessionUser(),
  ]);

  return (
    <aside
      className="flex flex-col shrink-0 border-r border-[var(--border)] bg-[var(--bg-secondary)] overflow-y-auto h-full"
      style={{ width: "var(--sidebar-width)" }}
    >
      <div className="flex items-center gap-2 px-3 py-3 border-b border-[var(--border)]">
        <div className="w-6 h-6 rounded bg-[var(--accent)] flex items-center justify-center text-white text-xs font-bold shrink-0">
          D
        </div>
        <span className="font-semibold text-sm truncate">Dugraphic Guide</span>
      </div>

      <nav className="flex flex-col gap-0.5 px-1 py-2 flex-1">
        {NAV_ITEMS.map((item) => (
          <SidebarItem key={item.href} {...item} />
        ))}

        <div className="mt-4 mb-1 px-2">
          <span className="text-xs font-medium text-[var(--fg-muted)] uppercase tracking-wider">
            페이지
          </span>
        </div>

        <SortablePagesList pages={pages} canEdit={role === "owner"} />

        {role === "owner" && <NewPageButton />}

        {databases.length > 0 && (
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
            <NewQuoteButton />
          </>
        )}
      </nav>

      <AuthSection email={email} role={role} />
    </aside>
  );
}
