"use client";

import { StatusBadge } from "@/components/ui/status-badge";

import { useTranslations } from "next-intl";
import { Search, UserRound } from "lucide-react";

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
import { Button } from "@/components/ui/button";
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

export function AdminTaskCommissionSection({
  onMarkAsPaid,
  rows,
  settlingTaskCommissionId = null,
}: {
  onMarkAsPaid?: (row: TaskCommissionRow) => void;
  rows: TaskCommissionRow[];
  settlingTaskCommissionId?: string | null;
}) {
  const t = useTranslations("Commission");
  const sharedTaskT = useTranslations("Tasks.shared");
  const { locale } = useLocale();
  const showActions = typeof onMarkAsPaid === "function";

  return (
    <DashboardListSection
      ariaLabel={t("taskSection.title")}
      bodyClassName="space-y-6"
    >
      {rows.length === 0 ? (
        <EmptyState
          description={t("taskSection.emptyDescription")}
          icon={<Search className="size-6" />}
          title={t("taskSection.emptyTitle")}
        />
      ) : (
        <DashboardTableFrame>
          <table className="min-w-[980px] w-full divide-y divide-border-subtle text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-[0.16em] text-content-muted uppercase">
                <th className="px-4 py-3">
                  {t("taskSection.table.columns.task")}
                </th>
                <th className="px-4 py-3">
                  {t("taskSection.table.columns.beneficiary")}
                </th>
                <th className="px-4 py-3">
                  {t("taskSection.table.columns.approvedBy")}
                </th>
                <th className="px-4 py-3">
                  {t("taskSection.table.columns.commission")}
                </th>
                <th className="px-4 py-3">
                  {t("taskSection.table.columns.time")}
                </th>
                {showActions ? (
                  <th className="px-4 py-3 text-right">
                    {t("taskSection.table.columns.actions")}
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((row) => {
                const isSettling = settlingTaskCommissionId === row.id;

                return (
                  <tr
                    key={row.id}
                    className="align-top transition-colors hover:bg-surface-inset"
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium text-content-strong">
                        {row.taskName}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge tone="info">
                          {getTaskTypeLabel(
                            row.taskTypeName,
                            row.taskTypeCode,
                            sharedTaskT,
                          )}
                        </StatusBadge>
                        <StatusBadge tone="info">
                          {getTaskScopeWithTeamLabel(row.taskScope, row.teamName, sharedTaskT)}
                        </StatusBadge>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-content-strong">
                        {row.beneficiary.label}
                      </div>
                      {row.beneficiary.email ? (
                        <div className="mt-2 text-xs text-content-muted">
                          {row.beneficiary.email}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <div className="inline-flex items-center gap-2 text-content-strong">
                        <UserRound className="size-4 text-primary" />
                        <span>
                          {row.approvedBy?.label ?? t("shared.fallback.none")}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-content-strong">
                        {formatCommissionMoney(row.commissionAmountRmb, locale)}
                      </div>
                      <div className="mt-2">
                        <StatusBadge
                          tone={getCommissionSettlementTone(row.settlementStatus)}
                        >
                          {getCommissionSettlementStatusLabel(
                            row.settlementStatus,
                            t,
                          )}
                        </StatusBadge>
                      </div>
                      {row.settlementNote ? (
                        <p className="mt-2 max-w-xs text-xs leading-6 text-content-muted">
                          {t("shared.note", { note: row.settlementNote })}
                        </p>
                      ) : null}
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
                    {showActions ? (
                      <td className="px-4 py-4 text-right">
                        {row.settlementStatus === "pending" && onMarkAsPaid ? (
                          <Button
                            variant="success"
                            size="default"
                            disabled={isSettling}
                            onClick={() => onMarkAsPaid(row)}
                            type="button"
                          >
                            {isSettling
                              ? t("actions.markingPaid")
                              : t("actions.markPaid")}
                          </Button>
                        ) : (
                          <span className="text-xs text-content-subtle">
                            {t("actions.noPendingAction")}
                          </span>
                        )}
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DashboardTableFrame>
      )}
    </DashboardListSection>
  );
}
