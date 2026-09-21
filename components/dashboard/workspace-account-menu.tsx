"use client";

import { Popover } from "@base-ui/react/popover";
import { useMemo, useState } from "react";

import Link from "next/link";
import {
  ChevronDown,
  IdCard,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  RefreshCw,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { InteractiveButton as DesignButton } from "@/components/ui/button";
import { signOutCurrentBrowserSession } from "@/lib/browser-auth-session";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import { useStaleFocusRecovery } from "@/lib/use-stale-focus-recovery";
import type { AppRole } from "@/lib/auth-routing";

import { useWorkspaceAccountSwitch } from "./use-workspace-account-switch";

type WorkspaceAccountMenuProps = {
  accountLabel: string;
  initials: string;
  myHref: string;
  role: AppRole;
};

export function WorkspaceAccountMenu({
  accountLabel,
  initials,
  myHref,
  role,
}: WorkspaceAccountMenuProps) {
  const t = useTranslations("DashboardShell");
  const shouldUseFullPageLoad = useStaleFocusRecovery();
  const supabase = getBrowserSupabaseClient();
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const accountSwitch = useWorkspaceAccountSwitch(role);
  const accountMenuItems = useMemo(
    () => [
      {
        href: `${myHref}#personal-center`,
        icon: LayoutDashboard,
        label: t("accountMenu.personalCenter"),
      },
      {
        href: `${myHref}#account-center`,
        icon: Settings,
        label: t("accountMenu.accountCenter"),
      },
      {
        href: `${myHref}#profile-info`,
        icon: IdCard,
        label: t("accountMenu.profileInfo"),
      },
      {
        href: `${myHref}#account-verification`,
        icon: ShieldCheck,
        label: t("accountMenu.accountVerification"),
      },
    ],
    [myHref, t],
  );

  const handleLogout = () => {
    if (logoutPending) return;
    setLogoutPending(true);
    signOutCurrentBrowserSession(supabase);
  };

  return (
    <Popover.Root
      onOpenChange={(open) => {
        setAccountMenuOpen(open);
        if (open) accountSwitch.setError(null);
      }}
      open={accountMenuOpen}
    >
      <Popover.Trigger
        render={
          <DesignButton
            aria-label={t("accountMenu.open")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-3 rounded-full bg-surface-inset p-1.5 transition-colors hover:bg-surface-interactive sm:pr-3"
            data-testid="workspace-account-menu-trigger"
            type="button"
          />
        }
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </span>
        <span className="hidden text-sm font-medium text-primary sm:inline">
          {accountLabel}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`hidden size-4 text-content-muted transition-transform duration-200 sm:block ${
            accountMenuOpen ? "rotate-180" : "rotate-0"
          }`}
        />
      </Popover.Trigger>

      {/*
       * Portal 会把菜单实际渲染到页面根层。这样菜单就不会被顶栏的 z-index
       * 层叠环境限制，页面里的吸顶表格、固定列或首页组件也无法覆盖到菜单上方。
       * Positioner 继续负责贴近账号按钮定位，并在窗口边缘自动翻转或平移。
       */}
      <Popover.Portal>
        <Popover.Positioner
          align="end"
          className="z-[65] max-w-[calc(100vw-1.5rem)] outline-none"
          collisionAvoidance={{
            align: "shift",
            fallbackAxisSide: "none",
            side: "flip",
          }}
          collisionPadding={12}
          sideOffset={12}
        >
          <Popover.Popup
            className="w-[min(240px,calc(100vw-1.5rem))] origin-[var(--transform-origin)] overflow-hidden rounded-control-large border border-border-subtle bg-surface-overlay shadow-surface-floating outline-none backdrop-blur-2xl backdrop-saturate-150 transition-[opacity,transform] duration-200 data-[starting-style]:translate-y-[-0.375rem] data-[starting-style]:scale-[0.985] data-[starting-style]:opacity-0 data-[ending-style]:translate-y-[-0.375rem] data-[ending-style]:scale-[0.985] data-[ending-style]:opacity-0 motion-reduce:transition-none"
            data-testid="workspace-account-menu"
            initialFocus={false}
          >
            <div className="border-b border-border-subtle px-4 py-3">
              <Popover.Title className="truncate text-sm font-semibold text-content-muted">
                {accountLabel}
              </Popover.Title>
            </div>

            <div className="p-2">
              {accountMenuItems.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    className="flex min-h-11 items-center gap-3 rounded-control-default px-3 py-2.5 text-sm font-medium text-content-muted transition-colors hover:bg-surface-inset"
                    href={item.href}
                    key={item.href}
                    onClick={(event) => {
                      setAccountMenuOpen(false);

                      // 长时间挂起后的页面需要完整加载，正常使用时仍保留站内快速跳转。
                      if (shouldUseFullPageLoad()) {
                        event.preventDefault();
                        window.location.assign(item.href);
                      }
                    }}
                    prefetch={false}
                  >
                    <Icon className="size-4 text-content-muted" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="border-t border-border-subtle p-2">
              <DesignButton
                className="flex min-h-11 w-full items-center gap-3 rounded-control-default px-3 py-2.5 text-left text-sm font-medium text-content-muted transition-colors hover:bg-surface-inset disabled:cursor-not-allowed disabled:opacity-70"
                data-testid="workspace-account-switch"
                disabled={accountSwitch.pending || logoutPending}
                onClick={() => void accountSwitch.switchAccount()}
                type="button"
              >
                {accountSwitch.pending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <RefreshCw className="size-4" />
                )}
                {t("accountMenu.switchAccount")}
              </DesignButton>
              {accountSwitch.error ? (
                <p aria-live="polite" className="px-3 py-2 text-xs leading-5 text-status-danger">
                  {t(accountSwitch.error === "session-expired"
                    ? "accountMenu.sessionExpired"
                    : "accountMenu.switchUnavailable")}
                </p>
              ) : null}
            </div>

            <div className="border-t border-border-subtle p-2">
              <DesignButton
                className="flex min-h-11 w-full items-center gap-3 rounded-control-default px-3 py-2.5 text-left text-sm font-semibold text-status-danger transition-colors hover:bg-surface-inset disabled:cursor-not-allowed disabled:opacity-70"
                disabled={logoutPending}
                onClick={handleLogout}
                type="button"
              >
                {logoutPending ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <LogOut className="size-4" />
                )}
                {t("logout")}
              </DesignButton>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
