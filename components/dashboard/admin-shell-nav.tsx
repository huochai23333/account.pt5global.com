"use client";

import { AdminShellDesktopNav } from "./admin-shell-desktop-nav";
import { AdminShellMobileNav } from "./admin-shell-mobile-nav";
import type {
  AdminShellNavGroup,
  AdminShellNavLink,
} from "./admin-shell-nav-types";

type AdminShellNavProps = {
  emptyGroupsLabel: string;
  globalItems: readonly AdminShellNavLink[];
  groups: readonly AdminShellNavGroup[];
  mode: "desktop" | "mobile";
};

/**
 * 主导航按页面宽度选择对应视图：桌面直接列出板块，手机使用顶部菜单。
 */
export function AdminShellNav({
  emptyGroupsLabel,
  globalItems,
  groups,
  mode,
}: AdminShellNavProps) {
  if (mode === "mobile") {
    return (
      <AdminShellMobileNav
        emptyGroupsLabel={emptyGroupsLabel}
        globalItems={globalItems}
        groups={groups}
      />
    );
  }

  return (
    <AdminShellDesktopNav
      emptyGroupsLabel={emptyGroupsLabel}
      globalItems={globalItems}
      groups={groups}
    />
  );
}
