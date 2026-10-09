"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

import { DesktopAdminNavLink } from "./admin-shell-nav-links";
import { AdminShellNavSearch } from "./admin-shell-nav-search";
import type {
  AdminShellNavGroup,
  AdminShellNavLink,
} from "./admin-shell-nav-types";
import { useAdminShellNavigation } from "./use-admin-shell-navigation";
import { useAdminShellNavSearch } from "./use-admin-shell-nav-search";

type AdminShellDesktopNavProps = {
  emptyGroupsLabel: string;
  globalItems: readonly AdminShellNavLink[];
  groups: readonly AdminShellNavGroup[];
};

// 左侧工作栏内容仍然需要能滚动，但视觉上不显示浏览器自带的滚动滑块。
const HIDDEN_NAV_SCROLLBAR_CLASS =
  "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** 桌面导航按权限直接列出业务板块，较长的菜单由侧栏自身滚动。 */
export function AdminShellDesktopNav({
  emptyGroupsLabel,
  globalItems,
  groups,
}: AdminShellDesktopNavProps) {
  const t = useTranslations("DashboardShell.navSearch");
  const items = useMemo(
    () => [...globalItems, ...groups.flatMap((group) => group.items)],
    [globalItems, groups],
  );
  const {
    handleNavClick,
    pathname,
    prefetchRoute,
    resolvedPendingHref,
  } = useAdminShellNavigation(items);
  // 搜索只改变显示清单，跳转仍使用完整的权限内菜单。
  const { filteredItems, query, setQuery } = useAdminShellNavSearch(items, pathname);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 搜索框放在滚动容器之外，短屏滚动菜单时仍能继续输入。 */}
      <AdminShellNavSearch onQueryChange={setQuery} query={query} />
      <nav
        className={cn(
          "min-h-0 flex-1 space-y-2 overflow-y-auto pr-1",
          HIDDEN_NAV_SCROLLBAR_CLASS,
        )}
      >
        {/* 全局入口和有权限的业务入口放在同一列，共用行高与缩进；分组资料仍供手机菜单使用。 */}
        {filteredItems.map((item) => (
          <DesktopAdminNavLink
            handleNavClick={handleNavClick}
            item={item}
            key={item.href}
            pathname={pathname}
            prefetchRoute={prefetchRoute}
            resolvedPendingHref={resolvedPendingHref}
          />
        ))}

        {query.trim() && filteredItems.length === 0 ? (
          <p className="mx-1 px-4 py-3 text-sm leading-6 text-content-muted" role="status">
            {t("empty")}
          </p>
        ) : null}
        {!query.trim() && groups.length === 0 ? (
          <p className="mx-1 rounded-record-card border border-border-subtle bg-surface-panel px-4 py-3 text-sm leading-6 text-content-muted">
            {emptyGroupsLabel}
          </p>
        ) : null}
      </nav>
    </div>
  );
}
