import type { ReactNode } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { AdminShellNav } from "@/components/dashboard/admin-shell-nav";
import { AdminShellLogoutButton } from "@/components/dashboard/admin-shell-client";
import type {
  AdminShellNavGroup,
  AdminShellNavLink,
} from "@/components/dashboard/admin-shell-nav-types";
import { AiAssistantClient } from "@/components/dashboard/ai-assistant/ai-assistant-client";
import { BrandMark } from "@/components/brand/brand-mark";
import { WorkspaceHeaderActions } from "@/components/dashboard/workspace-header-actions";
import { WorkspaceSessionProvider } from "@/components/dashboard/workspace-session-provider";
import { DashboardConfirmProvider } from "@/components/dashboard/dashboard-confirm-provider";
import {
  WorkspaceCustomizationSidebarProvider,
  WorkspaceDesktopSidebar,
} from "@/components/dashboard/workspace-customization-sidebar";
import { ScopedIntlProvider } from "@/components/i18n/scoped-intl-provider";
import { LanguageToggle } from "@/components/i18n/language-toggle";
import { getCompanyText } from "@/lib/company-config";
import { normalizeLocale } from "@/lib/locale";
import {
  getWorkspaceBusinessNavHref,
  getWorkspaceNavHref,
  type WorkspaceBusinessKey,
  type WorkspaceRouteConfig,
} from "@/lib/workspace-config";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { getSystemOperationHealth } from "@/lib/system-operation-health";
import { workspaceBusinessAccessIncludes } from "@/lib/workspace-business-access";
import {
  EMPTY_WORKSPACE_ANNOUNCEMENTS_STATE,
  getWorkspaceAnnouncementsState,
} from "@/lib/workspace-announcements";

type WorkspaceConfig = {
  accountLabel: string;
  globalNavItems: AdminShellNavLink[];
  initials: string;
  myHref: string;
  navGroups: AdminShellNavGroup[];
  subtitle: string;
  title: string;
  workspaceLabel: string;
};

type Translator = (key: string) => string;

type AdminShellProps = {
  children: ReactNode;
  config: WorkspaceRouteConfig;
  workspaceBusinessAccess: readonly WorkspaceBusinessKey[];
  wide?: boolean;
};

export async function AdminShell({
  children,
  config,
  workspaceBusinessAccess,
  wide = false,
}: AdminShellProps) {
  const [
    t,
    initialAnnouncementsState,
    systemAttentionCount,
    locale,
  ] = await Promise.all([
    getTranslations("DashboardShell"),
    getInitialWorkspaceAnnouncementsState(),
    getInitialSystemAttentionCount(config),
    getLocale(),
  ]);
  const companyText = getCompanyText(normalizeLocale(locale));
  const workspace = getWorkspaceConfig(
    config,
    t,
    workspaceBusinessAccess,
    systemAttentionCount,
  );

  return (
    <ScopedIntlProvider namespaces={["DashboardShell", "LanguageToggle"]}>
      <DashboardConfirmProvider>
        <WorkspaceSessionProvider>
          <WorkspaceCustomizationSidebarProvider>
            <div className="min-h-screen overflow-x-clip bg-background text-foreground">
              <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute right-[-10%] top-[-18%] h-[30rem] w-[30rem] rounded-full bg-[var(--workspace-glow-blue)] blur-3xl" />
                <div className="absolute bottom-[-14%] left-[-10%] h-[24rem] w-[24rem] rounded-full bg-[var(--workspace-glow-green)] blur-3xl" />
              </div>

              <div className="relative flex min-h-screen">
                {!wide ? <WorkspaceDesktopSidebar
                  defaultContent={
                    <>
                      <div className="mb-10 flex items-center gap-3 px-3">
                        <BrandMark priority size={48} />
                        <div>
                          <h2 className="text-sm font-bold tracking-wide text-primary">
                            {workspace.title}
                          </h2>
                          <p className="text-xs text-content-muted">
                            {workspace.subtitle}
                          </p>
                        </div>
                      </div>

                      <AdminShellNav
                        emptyGroupsLabel={t("business.noAccess")}
                        globalItems={workspace.globalNavItems}
                        groups={workspace.navGroups}
                        mode="desktop"
                      />

                      <AdminShellLogoutButton label={t("logout")} />
                    </>
                  }
                /> : null}

                {/* 768px 平板仍使用顶部导航，把完整内容宽度留给两列工作区；1024px 起再让出桌面侧栏。 */}
                <div className={`flex min-h-screen min-w-0 flex-1 flex-col ${wide ? "lg:ml-0" : "lg:ml-[284px]"}`}>
                  <header
                    className="sticky top-0 z-10 border-b border-border-subtle bg-surface-chrome/80 shadow-surface-header backdrop-blur"
                    data-slot="workspace-header"
                  >
                    <div className="mx-auto grid w-full max-w-[1600px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-3 py-3 sm:flex sm:justify-between sm:px-6 sm:py-4 lg:px-8">
                      <div className="min-w-[4.5rem] sm:min-w-0">
                        <p className="font-label whitespace-nowrap text-[10px] tracking-[0.08em] text-content-muted uppercase sm:text-[11px] sm:tracking-[0.2em]">
                          {workspace.workspaceLabel}
                        </p>
                        <h1 className="hidden text-xl font-bold tracking-tight text-primary sm:block sm:text-3xl">
                          {companyText.productName}
                        </h1>
                      </div>

                      <div className="flex items-center justify-end gap-2 sm:gap-3">
                        <LanguageToggle />
                        <WorkspaceHeaderActions
                          accountLabel={workspace.accountLabel}
                          initialAnnouncementsState={initialAnnouncementsState}
                          initials={workspace.initials}
                          myHref={workspace.myHref}
                          role={config.authRole}
                        />
                      </div>

                      <h1 className="col-span-2 break-words text-2xl font-bold tracking-tight text-primary sm:hidden">
                        {companyText.productName}
                      </h1>
                    </div>

                    <div className="px-3 pb-3 lg:hidden">
                      <AdminShellNav
                        emptyGroupsLabel={t("business.noAccess")}
                        globalItems={workspace.globalNavItems}
                        groups={workspace.navGroups}
                        mode="mobile"
                      />
                    </div>
                  </header>

                  <main className="flex-1 px-3 py-5 sm:px-6 sm:py-6 lg:px-8">
                    {children}
                  </main>
                  <AiAssistantClient />
                </div>
              </div>
            </div>
          </WorkspaceCustomizationSidebarProvider>
        </WorkspaceSessionProvider>
      </DashboardConfirmProvider>
    </ScopedIntlProvider>
  );
}

async function getInitialWorkspaceAnnouncementsState() {
  try {
    const supabase = await getServerSupabaseClient();

    return await getWorkspaceAnnouncementsState(supabase);
  } catch {
    return EMPTY_WORKSPACE_ANNOUNCEMENTS_STATE;
  }
}

async function getInitialSystemAttentionCount(config: WorkspaceRouteConfig) {
  if (!config.pageVariants.systemHealth) return 0;
  try {
    const supabase = await getServerSupabaseClient();
    return (await getSystemOperationHealth(supabase)).attentionCount;
  } catch {
    // 导航计数读取失败不应阻断整个工作台；管理员仍可进入系统运行页重试。
    return 0;
  }
}

function getWorkspaceConfig(
  config: WorkspaceRouteConfig,
  t: Translator,
  workspaceBusinessAccess: readonly WorkspaceBusinessKey[],
  systemAttentionCount: number,
): WorkspaceConfig {
  const roleKey = config.routeSegment;
  const globalNavItems = config.globalNavItems;
  const navGroups = config.navGroups
    .filter((group) =>
      workspaceBusinessAccessIncludes(workspaceBusinessAccess, group.business),
    )
    .map((group) => {
      return {
        items: group.navItems.map((item) => {
          const business = item.business ?? group.business;

          return {
            groupKey: group.business,
            groupLabel: t(`business.${group.labelKey}`),
            href: getWorkspaceBusinessNavHref(config, business, item.segment),
            icon: item.segment,
            label: t(`nav.${item.labelKey}`),
          };
        }),
        key: group.business,
        label: t(`business.${group.labelKey}`),
      };
    })
    .filter((group) => group.items.length > 0);

  return {
    accountLabel: t(`roles.${roleKey}.accountLabel`),
    globalNavItems: globalNavItems.map((item) => ({
      badgeCount: item.segment === "system-health" ? systemAttentionCount : undefined,
      href: getWorkspaceNavHref(config, item.segment),
      icon: item.segment,
      label: t(`nav.${item.labelKey}`),
    })),
    initials: config.initials,
    myHref: getWorkspaceNavHref(config, "my"),
    navGroups,
    subtitle: t(`roles.${roleKey}.subtitle`),
    title: t(`roles.${roleKey}.title`),
    workspaceLabel: t(`roles.${roleKey}.workspaceLabel`),
  };
}
