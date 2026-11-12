"use client";

import { StatusBadge } from "@/components/ui/status-badge";

import { ResponsiveDataView } from "@/components/ui/responsive-data-view";

import { Button, InteractiveButton as DesignButton } from "@/components/ui/button";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { UserCog } from "lucide-react";
import { DashboardTableFrame } from "@/components/dashboard/dashboard-section-panel";
import type { WholesaleProfile } from "@/lib/wholesale";
import { WholesaleEmptyState, WholesaleTd, WholesaleTh } from "./wholesale-ui";

export function WholesaleSalesAccountDirectory({
  accounts,
  onSelect,
}: {
  accounts: WholesaleProfile[];
  onSelect: (profile: WholesaleProfile) => void;
}) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_people_directories",
  );
  const t = useTranslations("WholesaleBusiness.directoryUi");
  if (accounts.length === 0) {
    return (
      <WholesaleEmptyState
        description={uiText("attribute003")}
        icon={<UserCog className="size-5" />}
        title={uiText("attribute004")}
      />
    );
  }
  return (
    <>
      <ResponsiveDataView
        desktop={
          <>
            <DashboardTableFrame>
              <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[28%]" />
                  <col className="w-[18%]" />
                  <col className="w-[13%]" />
                  <col className="w-[13%]" />
                </colgroup>
                <thead>
                  <tr>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text008" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text009" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text010" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text011" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text012" />
                    </WholesaleTh>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((profile) => (
                    <tr
                      className="cursor-pointer transition-colors hover:bg-surface-inset"
                      key={profile.user_id}
                      onClick={() => onSelect(profile)}
                    >
                      <WholesaleTd className="whitespace-normal">
                        {/* 键盘和鼠标打开同一详情；阻止按钮点击再由整行重复处理。 */}
                        <Button
                          onClick={(event) => {
                            event.stopPropagation();
                            onSelect(profile);
                          }}
                          size="compact"
                          type="button"
                          variant="ghost"
                          wrap
                        >
                          {profile.name ?? t("fallbacks.notProvided")}
                        </Button>
                      </WholesaleTd>
                      <WholesaleTd className="whitespace-normal">
                        <p>{profile.email ?? t("fallbacks.noEmail")}</p>
                        <p className="mt-1 text-xs text-content-muted">
                          {profile.phone ?? t("fallbacks.noPhone")}
                        </p>
                      </WholesaleTd>
                      <WholesaleTd className="whitespace-normal">
                        {profile.city ?? t("fallbacks.notProvided")}
                      </WholesaleTd>
                      <WholesaleTd className="whitespace-normal">
                        {profile.role === "promoter"
                          ? t("roles.promoter")
                          : t("roles.salesman")}
                      </WholesaleTd>
                      <WholesaleTd className="whitespace-normal">
                        <StatusBadge
                          tone={
                            profile.status === "active" ? "success" : "warning"
                          }
                        >
                          {profile.status === "active"
                            ? t("statuses.active")
                            : t("statuses.inactive")}
                        </StatusBadge>
                      </WholesaleTd>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DashboardTableFrame>
          </>
        }
        mobile={
          <>
            {accounts.map((profile) => (
              <DesignButton
                className="rounded-sm border border-border-subtle bg-surface-interactive p-4 text-left transition hover:border-border-subtle"
                key={profile.user_id}
                onClick={() => onSelect(profile)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-content-strong">
                      {profile.name ?? t("fallbacks.notProvided")}
                    </p>
                    <p className="mt-1 break-words text-sm text-content-muted">
                      {profile.email ??
                        profile.phone ??
                        t("fallbacks.noContact")}
                    </p>
                  </div>
                  <StatusBadge
                    tone={profile.status === "active" ? "success" : "warning"}
                  >
                    {profile.status === "active"
                      ? t("statuses.active")
                      : t("statuses.inactive")}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-sm text-content-muted">
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text013" />
                  {profile.role === "promoter"
                    ? t("roles.promoter")
                    : t("roles.salesman")}
                </p>
                <p className="mt-1 text-sm text-content-muted">
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text014" />
                  {profile.city ?? t("fallbacks.notProvided")}
                </p>
              </DesignButton>
            ))}
          </>
        }
      />
    </>
  );
}
