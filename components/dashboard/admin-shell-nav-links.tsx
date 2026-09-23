"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  BadgeCheck,
  BadgeDollarSign,
  ClipboardCheck,
  ClipboardClock,
  ClipboardList,
  ContactRound,
  GitBranchPlus,
  Home,
  HeartPulse,
  LayoutTemplate,
  LoaderCircle,
  Mail,
  Megaphone,
  MessageSquareWarning,
  ReceiptText,
  ShieldCheck,
  ShoppingCart,
  Truck,
  UserCog,
  UserRound,
  UsersRound,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import type { WorkspaceNavSegment } from "@/lib/workspace-config";
import { cn } from "@/lib/utils";

import type { AdminShellNavLink } from "./admin-shell-nav-types";
import { useAdminShellNavigation } from "./use-admin-shell-navigation";

// 图标与链接外观放在独立模块，主导航组件只处理分组展开和移动菜单状态。
export const ADMIN_NAV_ICONS: Record<WorkspaceNavSegment, LucideIcon> = {
  accounts: UserCog,
  announcements: Megaphone,
  "company-templates": LayoutTemplate,
  "company-expenses": ReceiptText,
  commission: WalletCards,
  customers: UsersRound,
  feedback: MessageSquareWarning,
  home: Home,
  incentives: BadgeDollarSign,
  "inventory-orders": ClipboardList,
  logistics: Truck,
  mail: Mail,
  leads: ContactRound,
  my: UserRound,
  "order-claims": ClipboardCheck,
  orders: ShoppingCart,
  people: UsersRound,
  records: ClipboardClock,
  reimbursements: ReceiptText,
  referrals: GitBranchPlus,
  reviews: ShieldCheck,
  settings: ArrowLeftRight,
  "system-health": HeartPulse,
  "settlement-releases": BadgeDollarSign,
  tasks: ClipboardList,
  team: UsersRound,
  vip: BadgeCheck,
};

type NavLinkProps = {
  handleNavClick: ReturnType<typeof useAdminShellNavigation>["handleNavClick"];
  item: AdminShellNavLink;
  pathname: string;
  prefetchRoute: ReturnType<typeof useAdminShellNavigation>["prefetchRoute"];
  resolvedPendingHref: string | null;
};

export function DesktopAdminNavLink({
  compact = false,
  handleNavClick,
  isFocusable = true,
  item,
  pathname,
  prefetchRoute,
  resolvedPendingHref,
}: NavLinkProps & { compact?: boolean; isFocusable?: boolean }) {
  const Icon = ADMIN_NAV_ICONS[item.icon];
  const isActive = pathname === item.href;
  const isPending = resolvedPendingHref === item.href && !isActive;

  // 登录后的板块只在用户悬停或聚焦时手动预载，
  // 避免页面刚打开就长期保存所有板块的旧数据。
  return (
    <Link
      aria-busy={isPending || undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "mx-1 flex items-center gap-3 rounded-record-card px-4 py-3 text-sm transition-all duration-200",
        compact ? "py-2.5" : "",
        isActive
          ? "translate-x-1 bg-primary text-white shadow-surface-interactive"
          : isPending
            ? "translate-x-1 bg-surface-inset text-brand-hover shadow-surface-interactive"
            : "text-content-muted/72 hover:bg-surface-inset hover:text-content-muted",
      )}
      href={item.href}
      onClick={(event) => handleNavClick(event, item.href)}
      onFocus={() => prefetchRoute(item.href)}
      onMouseEnter={() => prefetchRoute(item.href)}
      prefetch={false}
      tabIndex={isFocusable ? undefined : -1}
    >
      {isPending ? (
        <LoaderCircle className="size-[18px] shrink-0 animate-spin" />
      ) : (
        <Icon className="size-[18px] shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
      {item.badgeCount ? (
        <span className="min-w-5 rounded-full bg-status-danger px-1.5 py-0.5 text-center text-[11px] font-bold text-white">
          {item.badgeCount > 99 ? "99+" : item.badgeCount}
        </span>
      ) : null}
    </Link>
  );
}

export function MobileAdminNavLink({
  handleNavClick,
  isFocusable = true,
  item,
  pathname,
  prefetchRoute,
  resolvedPendingHref,
  setMobileMenuOpen,
}: NavLinkProps & {
  isFocusable?: boolean;
  setMobileMenuOpen: (value: boolean) => void;
}) {
  // 报价模板需要桌面录入和打印，手机菜单不提供这个入口。
  if (item.icon === "company-templates") return null;
  const Icon = ADMIN_NAV_ICONS[item.icon];
  const isActive = pathname === item.href;
  const isPending = resolvedPendingHref === item.href && !isActive;

  // 移动端没有稳定的悬停动作，点击时直接读取最新页面，
  // 避免复用长时间闲置前保存的页面内容。
  return (
    <Link
      aria-busy={isPending || undefined}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex min-h-11 min-w-0 items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-primary text-white shadow-surface-interactive"
          : isPending
            ? "bg-surface-inset text-brand-hover"
            : "text-primary hover:bg-status-info-soft",
      )}
      href={item.href}
      onClick={(event) => {
        handleNavClick(event, item.href);
        setMobileMenuOpen(false);
      }}
      onFocus={() => prefetchRoute(item.href)}
      onMouseEnter={() => prefetchRoute(item.href)}
      prefetch={false}
      tabIndex={isFocusable ? undefined : -1}
    >
      {isPending ? (
        <LoaderCircle className="size-4 shrink-0 animate-spin" />
      ) : (
        <Icon className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
      {item.badgeCount ? (
        <span className="min-w-5 rounded-full bg-status-danger px-1.5 py-0.5 text-center text-[11px] font-bold text-white">
          {item.badgeCount > 99 ? "99+" : item.badgeCount}
        </span>
      ) : null}
    </Link>
  );
}
