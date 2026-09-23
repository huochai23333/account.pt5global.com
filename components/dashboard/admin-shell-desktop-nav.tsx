"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

import { DesktopAdminNavLink } from "./admin-shell-nav-links";
import type {
  AdminShellNavGroup,
  AdminShellNavLink,
} from "./admin-shell-nav-types";
import { useAdminShellNavigation } from "./use-admin-shell-navigation";

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
  return (
    <nav
      className={cn(
        "min-h-0 flex-1 space-y-2 overflow-y-auto pr-1",
        HIDDEN_NAV_SCROLLBAR_CLASS,
      )}
    >
      {globalItems.map((item) => (
        <DesktopAdminNavLink
          handleNavClick={handleNavClick}
          item={item}
          key={item.href}
          pathname={pathname}
          prefetchRoute={prefetchRoute}
          resolvedPendingHref={resolvedPendingHref}
        />
      ))}

      {groups.length === 0 ? (
        <p className="mx-1 rounded-record-card border border-border-subtle bg-surface-panel px-4 py-3 text-sm leading-6 text-content-muted">
          {emptyGroupsLabel}
        </p>
      ) : null}

      {groups.map((group) => {
        return (
          <div className="space-y-1" key={group.key}>
            {/* 分组名称只是阅读提示；所有有权限的入口始终可点击。 */}
            <p className="mx-1 px-4 py-3 text-sm font-semibold text-content-muted/76">
              {group.label}
            </p>
            <div className="space-y-1 pl-3 pt-1">
              {group.items.map((item) => (
                <DesktopAdminNavLink
                  compact
                  handleNavClick={handleNavClick}
                  item={item}
                  key={item.href}
                  pathname={pathname}
                  prefetchRoute={prefetchRoute}
                  resolvedPendingHref={resolvedPendingHref}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
