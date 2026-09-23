"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import { useMemo, useState } from "react";

import { ChevronDown, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

import { ADMIN_NAV_ICONS, MobileAdminNavLink } from "./admin-shell-nav-links";
import type {
  AdminShellNavGroup,
  AdminShellNavLink,
} from "./admin-shell-nav-types";
import { useAdminShellNavigation } from "./use-admin-shell-navigation";

type AdminShellMobileNavProps = {
  emptyGroupsLabel: string;
  globalItems: readonly AdminShellNavLink[];
  groups: readonly AdminShellNavGroup[];
};

/** 移动导航保留顶部菜单，展开时展示当前账号可访问的完整板块清单。 */
export function AdminShellMobileNav({
  emptyGroupsLabel,
  globalItems,
  groups,
}: AdminShellMobileNavProps) {
  const items = useMemo(
    () => [...globalItems, ...groups.flatMap((group) => group.items)],
    [globalItems, groups],
  );
  const {
    activeItem,
    handleNavClick,
    pathname,
    prefetchRoute,
    resolvedPendingHref,
  } = useAdminShellNavigation(items);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!activeItem) {
    return null;
  }

  const activeGroupKey = activeItem.groupKey ?? null;
  const mobileGroups = activeGroupKey
    ? [
        ...groups.filter((group) => group.key === activeGroupKey),
        ...groups.filter((group) => group.key !== activeGroupKey),
      ]
    : groups;
  const ActiveIcon = ADMIN_NAV_ICONS[activeItem.icon];
  const activeIsPending = resolvedPendingHref === activeItem.href;
  const activeLabel = activeItem.groupLabel
    ? `${activeItem.groupLabel} / ${activeItem.label}`
    : activeItem.label;

  return (
    <div className="relative">
      <DesignButton
        aria-expanded={mobileMenuOpen}
        aria-label={activeLabel}
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-record-card border border-surface-panel-border bg-surface-overlay px-4 py-3 text-left text-primary shadow-surface-interactive backdrop-blur transition-colors hover:bg-surface-inset"
        onClick={() => setMobileMenuOpen((value) => !value)}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          {activeIsPending ? (
            <LoaderCircle className="size-4 shrink-0 animate-spin" />
          ) : (
            <ActiveIcon className="size-4 shrink-0" />
          )}
          <span className="min-w-0 truncate text-sm font-semibold">
            {activeLabel}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            mobileMenuOpen ? "rotate-180" : "rotate-0",
          )}
        />
      </DesignButton>

      <nav
        aria-hidden={!mobileMenuOpen}
        className={cn(
          "absolute left-0 right-0 top-[calc(100%+0.5rem)] z-30 max-h-[62vh] overflow-y-auto rounded-control-large border border-surface-panel-border bg-surface-overlay p-2 shadow-surface-interactive backdrop-blur-2xl backdrop-saturate-150 transition-[opacity,transform,clip-path] duration-200 ease-out",
          mobileMenuOpen
            ? "pointer-events-auto translate-y-0 opacity-100 [clip-path:inset(0_0_0_0)]"
            : "pointer-events-none -translate-y-1 opacity-0 [clip-path:inset(0_0_100%_0)]",
        )}
      >
        <div className="grid gap-2">
          {globalItems.map((item) => (
            <MobileAdminNavLink
              handleNavClick={handleNavClick}
              isFocusable={mobileMenuOpen}
              item={item}
              key={item.href}
              pathname={pathname}
              prefetchRoute={prefetchRoute}
              resolvedPendingHref={resolvedPendingHref}
              setMobileMenuOpen={setMobileMenuOpen}
            />
          ))}
          {mobileGroups.length > 0 ? (
            mobileGroups.map((group) => (
              <div className="grid gap-1.5" key={group.key}>
                <p className="px-3 pt-2 text-[11px] font-semibold tracking-[0.12em] text-content-muted uppercase">
                  {group.label}
                </p>
                {group.items.map((item) => (
                  <MobileAdminNavLink
                    handleNavClick={handleNavClick}
                    isFocusable={mobileMenuOpen}
                    item={item}
                    key={item.href}
                    pathname={pathname}
                    prefetchRoute={prefetchRoute}
                    resolvedPendingHref={resolvedPendingHref}
                    setMobileMenuOpen={setMobileMenuOpen}
                  />
                ))}
              </div>
            ))
          ) : (
            <p className="px-3 py-3 text-sm leading-6 text-content-muted">
              {emptyGroupsLabel}
            </p>
          )}
        </div>
      </nav>
    </div>
  );
}
