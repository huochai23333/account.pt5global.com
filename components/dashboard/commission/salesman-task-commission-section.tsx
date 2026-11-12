"use client";

import { StatusBadge } from "@/components/ui/status-badge";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import type { TaskCommissionRow } from "@/lib/task-commissions";
import { useLocale } from "@/components/i18n/locale-provider";
import {
  DashboardListSection,
  DashboardTableFrame,
} from "@/components/dashboard/dashboard-section-panel";
import {
  EmptyState,
  formatDateTime,
} from "@/components/dashboard/dashboard-shared-ui";
import {
  getTaskScopeWithTeamLabel,
  getTaskTypeLabel,
} from "@/components/dashboard/tasks/tasks-display";

import {
  formatCommissionMoney,
  getCommissionSettlementStatusLabel,
} from "./commission-display";
import {
  CommissionDetailLine,
  getCommissionSettlementTone,
} from "./admin-commission-record-utils";

export function SalesmanTaskCommissionSection({
  rows,
}: {
  rows: TaskCommissionRow[];
}) {
  const t = useTranslations("Commission");
  const sharedTaskT = useTranslations("Tasks.shared");
  const { locale } = useLocale();

  return (
    <DashboardListSection
      ariaLabel={t("salesmanTaskSection.title")}
      bodyClassName="space-y-6"
    >
      {rows.length === 0 ? (
        <EmptyState
          description={t("salesmanTaskSection.emptyDescription")}
          icon={<Search className="size-6" />}
          title={t("salesmanTaskSection.emptyTitle")}
        />
      ) : (
        <DashboardTableFrame>
          <table className="min-w-[900px] w-full divide-y divide-border-subtle text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-[0.16em] text-content-muted uppercase">
                <th className="px-4 py-3">
                  {t("salesmanTaskSection.table.columns.task")}
                </th>
                <th className="px-4 py-3">
                  {t("salesmanTaskSection.table.columns.typeScope")}
                </th>
                <th className="px-4 py-3">
                  {t("salesmanTaskSection.table.columns.amount")}
                </th>
                <th className="px-4 py-3">
                  {t("salesmanTaskSection.table.columns.settlement")}
                </th>
                <th className="px-4 py-3">
                  {t("salesmanTaskSection.table.columns.time")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="align-top transition-colors hover:bg-surface-inset"
                >
                  <td className="px-4 py-4">
                    <div className="font-medium text-content-strong">
                      {row.taskName}
                    </div>
                    {row.settlementNote ? (
                      <p className="mt-2 max-w-sm text-xs leading-6 text-content-muted">
                        {t("shared.note", { note: row.settlementNote })}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-content-strong">
                      {getTaskTypeLabel(
                        row.taskTypeName,
                        row.taskTypeCode,
                        sharedTaskT,
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge tone="info">
                        {getTaskScopeWithTeamLabel(row.taskScope, row.teamName, sharedTaskT)}
                      </StatusBadge>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-semibold text-content-strong">
                      {formatCommissionMoney(row.commissionAmountRmb, locale)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge tone={getCommissionSettlementTone(row.settlementStatus)}>
                      {getCommissionSettlementStatusLabel(
                        row.settlementStatus,
                        t,
                      )}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-4">
                    <CommissionDetailLine
                      label={t("shared.fields.createdAt")}
                      value={formatDateTime(row.createdAt, locale)}
                    />
                    <CommissionDetailLine
                      label={t("shared.fields.settledAt")}
                      value={formatDateTime(row.settledAt, locale)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashboardTableFrame>
      )}
    </DashboardListSection>
  );
}
