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
        // 资料库只提供电脑端入口；过滤后，手机菜单的当前板块名称也不会选中资料库。
        globalItems={globalItems.filter((item) => item.icon !== "documents")}
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
