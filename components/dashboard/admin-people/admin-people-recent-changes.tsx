"use client";

import { Clock3 } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardListSection, DashboardTableFrame } from "@/components/dashboard/dashboard-section-panel";
import { EmptyState } from "@/components/dashboard/dashboard-shared-ui";
import { UiMessage } from "@/components/i18n/ui-message";
import { RecordCard } from "@/components/ui/data-display";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import type { AdminPeopleChangeLogRow } from "@/lib/admin-people-contract";
import type { Locale } from "@/lib/locale";

import { formatPeopleDate, getRoleLabel, getStatusLabel } from "./admin-people-display";
import type { useAdminPeopleViewModel } from "./use-admin-people-view-model";

type AdminPeopleViewModel = ReturnType<typeof useAdminPeopleViewModel>;

// 最近记录只展示服务器返回的审计行，桌面和手机共享相同的变更摘要。
export function AdminPeopleRecentChangesSection({
  changes,
  locale,
  roleLabels,
  statusLabels,
}: {
  changes: AdminPeopleChangeLogRow[];
  locale: Locale;
  roleLabels: AdminPeopleViewModel["roleLabels"];
  statusLabels: AdminPeopleViewModel["statusLabels"];
}) {
  const t = useTranslations("AdminPeople");
  const fallback = t("fallback.notProvided");
  return (
    <DashboardListSection
      title={t("logs.title")}
    >
      {changes.length === 0 ? (
        <EmptyState
          description={t("logs.emptyDescription")}
          icon={<Clock3 className="size-5" />}
          title={t("logs.emptyTitle")}
        />
      ) : (
        <>
          <ResponsiveDataView
            desktop={
              <>
                <DashboardTableFrame>
                  <table className="min-w-[900px] w-full text-left text-sm">
                    <thead className="bg-surface-inset text-xs font-semibold text-content-muted">
                      <tr>
                        <th className="px-4 py-3">
                          {t("logs.columns.target")}
                        </th>
                        <th className="px-4 py-3">
                          {t("logs.columns.change")}
                        </th>
                        <th className="px-4 py-3">{t("logs.columns.actor")}</th>
                        <th className="px-4 py-3">{t("logs.columns.note")}</th>
                        <th className="px-4 py-3">{t("logs.columns.time")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {changes.map((change) => (
                        <tr key={change.id} className="align-top">
                          <td className="px-4 py-4">
                            <p className="font-semibold text-content-strong">
                              {change.target_name ??
                                change.target_email ??
                                fallback}
                            </p>
                            <p className="mt-1 text-xs text-content-muted">
                              {change.target_email ?? fallback}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-content-muted">
                            <ChangeSummary
                              change={change}
                              fallback={fallback}
                              roleLabels={roleLabels}
                              statusLabels={statusLabels}
                            />
                          </td>
                          <td className="px-4 py-4 text-content-muted">
                            {change.actor_name ??
                              change.actor_email ??
                              fallback}
                          </td>
                          <td className="max-w-[260px] px-4 py-4 text-content-muted">
                            {change.note ?? t("logs.noNote")}
                          </td>
                          <td className="px-4 py-4 text-content-muted">
                            {formatPeopleDate(
                              change.created_at,
                              locale,
                              fallback,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </DashboardTableFrame>
              </>
            }
            mobile={
              <>
                {changes.map((change) => (
                  <RecordCard key={change.id}>
                    <p className="font-semibold text-content-strong">
                      {change.target_name ?? change.target_email ?? fallback}
                    </p>
                    <p className="mt-1 break-all text-xs text-content-muted">
                      {change.target_email ?? fallback}
                    </p>
                    <div className="mt-3 text-sm leading-6 text-content-muted">
                      <ChangeSummary
                        change={change}
                        fallback={fallback}
                        roleLabels={roleLabels}
                        statusLabels={statusLabels}
                      />
                    </div>
                    <p className="mt-3 text-sm text-content-muted">
                      <UiMessage id="components_dashboard_admin_people_admin_people_sections.text001" />
                      {change.actor_name ?? change.actor_email ?? fallback}
                    </p>
                    <p className="mt-1 break-words text-sm text-content-muted">
                      <UiMessage id="components_dashboard_admin_people_admin_people_sections.text002" />
                      {change.note ?? t("logs.noNote")}
                    </p>
                    <p className="mt-1 text-xs text-content-muted">
                      {formatPeopleDate(change.created_at, locale, fallback)}
                    </p>
                  </RecordCard>
                ))}
              </>
            }
          />
        </>
      )}
    </DashboardListSection>
  );
}
function ChangeSummary({
  change,
  fallback,
  roleLabels,
  statusLabels,
}: {
  change: AdminPeopleChangeLogRow;
  fallback: string;
  roleLabels: AdminPeopleViewModel["roleLabels"];
  statusLabels: AdminPeopleViewModel["statusLabels"];
}) {
  const t = useTranslations("AdminPeople");
  return (
    <>
      <p>
        {getRoleLabel(change.previous_role, roleLabels, fallback)}
        {" -> "}
        {getRoleLabel(change.next_role, roleLabels, fallback)}
      </p>
      <p className="mt-1">
        {getStatusLabel(change.previous_status, statusLabels, fallback)}
        {" -> "}
        {getStatusLabel(change.next_status, statusLabels, fallback)}
      </p>
      {change.previous_city !== change.next_city ? (
        <p className="mt-1">
          {t("logs.cityChange", {
            from: change.previous_city ?? fallback,
            to: change.next_city ?? fallback,
          })}
        </p>
      ) : null}
    </>
  );
}
