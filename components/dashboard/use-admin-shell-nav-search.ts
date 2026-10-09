"use client";

import { useMemo, useState } from "react";
import type { AdminShellNavLink } from "./admin-shell-nav-types";

/** 只筛选调用方已按权限生成的菜单；不能从完整业务注册表补充搜索结果。 */
export function filterAdminShellNavItems(
  items: readonly AdminShellNavLink[],
  query: string,
): readonly AdminShellNavLink[] {
  const keyword = query.trim().toLowerCase();
  return keyword
    ? items.filter((item) => item.label.toLowerCase().includes(keyword))
    : items;
}

/** 搜索与当前页面绑定：成功切换地址才重置，点击后仍在等待时保留输入。 */
export function useAdminShellNavSearch(
  items: readonly AdminShellNavLink[],
  pathname: string,
) {
  const [search, setSearch] = useState({ pathname, query: "" });
  const query = search.pathname === pathname ? search.query : "";

  // 在当前组件渲染中同步重置，避免旧关键词闪现，也避免后退时恢复已离开的页面搜索。
  if (search.pathname !== pathname) {
    setSearch({ pathname, query: "" });
  }

  const filteredItems = useMemo(
    () => filterAdminShellNavItems(items, query),
    [items, query],
  );
  const setQuery = (value: string) => setSearch({ pathname, query: value });
  return { filteredItems, query, setQuery };
}
