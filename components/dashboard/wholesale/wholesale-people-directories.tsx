"use client";

import { StatusBadge } from "@/components/ui/status-badge";

import { ResponsiveDataView } from "@/components/ui/responsive-data-view";

import { Button, InteractiveButton as DesignButton } from "@/components/ui/button";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { UserCog, UsersRound } from "lucide-react";
import { DashboardTableFrame } from "@/components/dashboard/dashboard-section-panel";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import { WholesaleDetailGrid } from "./wholesale-detail-grid";
import { formatDate } from "./wholesale-display";
import { WholesaleEmptyState, WholesaleTd, WholesaleTh } from "./wholesale-ui";
export function WholesaleCustomerDirectory({
  customers,
  onSelect,
  profilesById,
}: {
  customers: WholesaleCustomer[];
  onSelect: (customer: WholesaleCustomer) => void;
  profilesById: Map<string, WholesaleProfile>;
}) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_people_directories",
  );
  const t = useTranslations("WholesaleBusiness.directoryUi");
  if (customers.length === 0) {
    return (
      <WholesaleEmptyState
        description={uiText("attribute001")}
        icon={<UsersRound className="size-5" />}
        title={uiText("attribute002")}
      />
    );
  }
  return (
    <>
      <ResponsiveDataView
        desktop={
          <>
            <DashboardTableFrame>
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[24%]" />
                  <col className="w-[20%]" />
                  <col className="w-[14%]" />
                  <col className="w-[14%]" />
                </colgroup>
                <thead>
                  <tr>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text001" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text002" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text003" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text004" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text005" />
                    </WholesaleTh>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr
                      className="transition-colors hover:bg-surface-inset"
                      key={customer.id}
                    >
                      <WholesaleTd className="whitespace-normal">
                        {/* 客户名称是真正的键盘入口，弹窗关闭时可回到触发按钮。 */}
                        <Button
                          onClick={() => onSelect(customer)}
                          size="compact"
                          type="button"
                          variant="ghost"
                          wrap
                        >
                          {customer.unique_name}
                        </Button>
                        <p className="mt-1 text-xs text-content-muted">
                          {customer.other_names.length > 0
                            ? customer.other_names.join("、")
                            : t("fallbacks.noOtherNames")}
                        </p>
                      </WholesaleTd>
                      <WholesaleTd className="whitespace-normal">
                        <p>
                          {customer.contact_details ??
                            t("fallbacks.notRecorded")}
                        </p>
                        <p className="mt-1 text-xs text-content-muted">
                          {customer.source ?? t("fallbacks.noSource")}
                        </p>
                      </WholesaleTd>
                      <WholesaleTd className="whitespace-normal">
                        {getLocalizedProfileName(
                          profilesById,
                          customer.assigned_sales_user_id,
                          t("fallbacks.unassigned"),
                        )}
                      </WholesaleTd>
                      <WholesaleTd className="whitespace-normal">
                        <StatusBadge>
                          {t(`customerKinds.${customer.customer_kind}`)}
                        </StatusBadge>
                        <p className="mt-2 text-xs text-content-muted">
                          {customer.registered_user_id
                            ? getLocalizedProfileName(
                                profilesById,
                                customer.registered_user_id,
                                t("fallbacks.unnamed"),
                              )
                            : t("fallbacks.notLinkedAccount")}
                        </p>
                      </WholesaleTd>
                      <WholesaleTd className="whitespace-normal">
                        {formatDate(customer.created_at)}
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
            {customers.map((customer) => (
              <DesignButton
                className="rounded-control-large border border-border-subtle bg-surface-interactive p-4 text-left"
                key={customer.id}
                onClick={() => onSelect(customer)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-content-strong">
                      {customer.unique_name}
                    </p>
                    <p className="mt-1 break-words text-sm text-content-muted">
                      {customer.contact_details ?? t("fallbacks.noContact")}
                    </p>
                  </div>
                  <StatusBadge>
                    {t(`customerKinds.${customer.customer_kind}`)}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-sm text-content-muted">
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text006" />
                  {getLocalizedProfileName(
                    profilesById,
                    customer.assigned_sales_user_id,
                    t("fallbacks.unassigned"),
                  )}
                </p>
                <p className="mt-1 text-sm text-content-muted">
                  <UiMessage id="components_dashboard_wholesale_wholesale_people_directories.text007" />
                  {customer.registered_user_id
                    ? getLocalizedProfileName(
                        profilesById,
                        customer.registered_user_id,
                        t("fallbacks.unnamed"),
                      )
                    : t("fallbacks.notLinked")}
                </p>
              </DesignButton>
            ))}
          </>
        }
      />
    </>
  );
}
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
                        {profile.name ?? t("fallbacks.notProvided")}
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
export function WholesaleAccountDetails({
  profile,
}: {
  profile: WholesaleProfile;
}) {
  const t = useTranslations("WholesaleBusiness.directoryUi");
  const rows = [
    {
      label: t("details.name"),
      value: profile.name ?? t("fallbacks.notProvided"),
    },
    {
      label: t("details.email"),
      value: profile.email ?? t("fallbacks.notProvided"),
    },
    {
      label: t("details.phone"),
      value: profile.phone ?? t("fallbacks.notProvided"),
    },
    {
      label: t("details.city"),
      value: profile.city ?? t("fallbacks.notProvided"),
    },
    {
      label: t("details.role"),
      value:
        profile.role === "promoter" ? t("roles.promoter") : t("roles.salesman"),
    },
    {
      label: t("details.status"),
      value:
        profile.status === "active"
          ? t("statuses.active")
          : t("statuses.inactive"),
    },
  ];
  return <WholesaleDetailGrid rows={rows} />;
}

function getLocalizedProfileName(
  profilesById: Map<string, WholesaleProfile>,
  userId: string | null,
  fallback: string,
) {
  if (!userId) return fallback;
  const profile = profilesById.get(userId);
  return profile?.name || profile?.email || fallback;
}
