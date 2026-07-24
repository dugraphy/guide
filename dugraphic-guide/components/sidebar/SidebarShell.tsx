"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, PanelLeft, PanelLeftClose } from "lucide-react";

const STORAGE_KEY = "dg-sidebar-collapsed";

interface Props {
  header: React.ReactNode;
  collapsedNav: React.ReactNode;
  children: React.ReactNode;
}

export default function SidebarShell({ header, collapsedNav, children }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // 저장된 접힘 상태 복원 (localStorage는 클라이언트에서만 접근 가능하므로 마운트 후 반영)
  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") {
      setCollapsed(true);
    }
  }, []);

  // 페이지 이동 시 모바일 드로어는 자동으로 닫는다
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="메뉴 열기"
        className="md:hidden fixed top-3 left-3 z-30 flex items-center justify-center w-9 h-9 rounded-md border border-[var(--border)] bg-[var(--bg)] text-[var(--fg)] shadow-sm active:scale-95 transition-transform"
      >
        <Menu size={18} />
      </button>

      <div
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
        className={`md:hidden fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex shrink-0 h-full w-60
          bg-[var(--bg-secondary)] border-r border-[var(--border)]
          transition-all duration-200 ease-in-out overflow-hidden
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:static md:z-auto md:translate-x-0
          ${collapsed ? "md:w-14" : ""}`}
      >
        <div className="flex flex-col h-full w-60 shrink-0 overflow-y-auto">
          <div className="flex items-center border-b border-[var(--border)] shrink-0">
            <div
              className={`flex items-center overflow-hidden py-3 pl-3 flex-1 min-w-0 opacity-100 transition-all duration-200 ease-in-out ${
                collapsed ? "md:flex-none md:w-0 md:pl-0 md:opacity-0 md:pointer-events-none" : ""
              }`}
            >
              {header}
            </div>

            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              title={collapsed ? "사이드바 펼치기" : "사이드바 접기"}
              className="hidden md:flex items-center justify-center w-14 py-3 shrink-0 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--hover)] transition-colors"
            >
              {collapsed ? <PanelLeft size={17} /> : <PanelLeftClose size={17} />}
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="메뉴 닫기"
              className="md:hidden flex items-center justify-center w-9 h-9 mr-2 shrink-0 text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              <X size={18} />
            </button>
          </div>

          <div className={`flex flex-col flex-1 min-h-0 ${collapsed ? "md:hidden" : ""}`}>
            {children}
          </div>

          <div
            className={`hidden w-14 flex-1 min-h-0 flex-col items-center gap-1 py-2 ${
              collapsed ? "md:flex" : ""
            }`}
          >
            {collapsedNav}
          </div>
        </div>
      </aside>
    </>
  );
}
