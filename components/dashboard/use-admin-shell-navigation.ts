"use client";

import { useCallback, useMemo, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { usePathname, useRouter } from "next/navigation";

import { useStaleFocusRecovery } from "@/lib/use-stale-focus-recovery";

import type { AdminShellNavLink } from "./admin-shell-nav-types";

type PendingNavigation = {
  href: string;
  startPathname: string;
};

export function useAdminShellNavigation(
  items: readonly AdminShellNavLink[],
) {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingNavigation, setPendingNavigation] =
    useState<PendingNavigation | null>(null);
  const shouldUseFullPageLoad = useStaleFocusRecovery();
  const resolvedPendingHref =
    pendingNavigation?.startPathname === pathname ? pendingNavigation.href : null;
  const activeItem = useMemo(
    () => {
      // 模板查看、详情等子页面仍属于它们的工作栏入口；优先选择最长的匹配地址，避免手机菜单退回显示“首页”。
      const matchingItems = items
        .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
        .sort((left, right) => right.href.length - left.href.length);
      return matchingItems[0] ?? items[0] ?? null;
    },
    [items, pathname],
  );

  const prefetchRoute = useCallback(
    (href: string) => {
      if (href === pathname) {
        return;
      }

      void router.prefetch(href);
    },
    [pathname, router],
  );

  const handleNavClick = useCallback(
    (event: ReactMouseEvent<HTMLAnchorElement>, href: string) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        href === pathname
      ) {
        return;
      }

      const nextPendingNavigation = {
        href,
        startPathname: pathname,
      };

      setPendingNavigation(nextPendingNavigation);

      if (shouldUseFullPageLoad()) {
        event.preventDefault();
        window.location.assign(href);
      }
    },
    [pathname, shouldUseFullPageLoad],
  );

  return {
    activeItem,
    handleNavClick,
    pathname,
    prefetchRoute,
    resolvedPendingHref,
  };
}
