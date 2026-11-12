"use client";

import { StatusBadge } from "@/components/ui/status-badge";

import { useTranslations } from "next-intl";
import { UsersRound } from "lucide-react";

import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import {
  DashboardListSection,
  DashboardTableFrame,
} from "@/components/dashboard/dashboard-section-panel";
import {
  createDashboardSharedCopy,
  EmptyState,
  formatDateTime,
  mapUserStatus,
} from "@/components/dashboard/dashboard-shared-ui";

import type { BeneficiarySummaryRow } from "./admin-commission-view-model";
import { formatCommissionMoney, getCommissionRoleLabel } from "./commission-display";

// 以受益人聚合的结果由上游提供，本区块只展示并发出下钻事件。
export function CommissionBeneficiarySummarySection({
  rows,
  onViewAll,
}: {
  onViewAll: (userId: string) => void;
  rows: BeneficiarySummaryRow[];
}) {
  const t = useTranslations("Commission");
  const sharedT = useTranslations("DashboardShared");
  const { locale } = useLocale();
  const sharedCopy = createDashboardSharedCopy(sharedT);

  return (
    <DashboardListSection
      title={t("beneficiaries.title")}
    >
      {rows.length === 0 ? (
        <EmptyState
          description={t("beneficiaries.emptyDescription")}
          icon={<UsersRound className="size-6" />}
          title={t("beneficiaries.emptyTitle")}
        />
      ) : (
        <DashboardTableFrame>
          <table className="min-w-[980px] w-full divide-y divide-border-subtle text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-[0.16em] text-content-muted uppercase">
                <th className="px-4 py-3">
                  {t("beneficiaries.columns.beneficiary")}
                </th>
                <th className="px-4 py-3">
                  {t("beneficiaries.columns.roleStatus")}
                </th>
                <th className="px-4 py-3">
                  {t("beneficiaries.columns.recordCount")}
                </th>
                <th className="px-4 py-3">
                  {t("beneficiaries.columns.totalAmount")}
                </th>
                <th className="px-4 py-3">
                  {t("beneficiaries.columns.pendingAmount")}
                </th>
                <th className="px-4 py-3">
                  {t("beneficiaries.columns.paidAmount")}
                </th>
                <th className="px-4 py-3">
                  {t("beneficiaries.columns.latestRecord")}
                </th>
                <th className="px-4 py-3 text-right">
                  {t("beneficiaries.columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {rows.map((beneficiary) => {
                const beneficiaryStatus = mapUserStatus(
                  beneficiary.status,
                  sharedCopy,
                );

                return (
                  <tr
                    key={beneficiary.userId}
                    className="bg-surface-panel transition-colors hover:bg-surface-inset"
                  >
                    <td className="px-4 py-4">
                      <div className="font-medium text-content-strong">
                        {beneficiary.label}
                      </div>
                      {beneficiary.email ? (
                        <div className="mt-1 text-xs text-content-muted">
                          {beneficiary.email}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge tone="info">
                          {getCommissionRoleLabel(beneficiary.role, t)}
                        </StatusBadge>
                        <StatusBadge
                          tone={
                            beneficiaryStatus.accent === "success"
                              ? "success"
                              : "warning"
                          }
                        >
                          {beneficiaryStatus.label}
                        </StatusBadge>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-content-strong">
                      {beneficiary.recordCount}
                    </td>
                    <td className="px-4 py-4 text-content-strong">
                      {formatCommissionMoney(beneficiary.totalAmount, locale)}
                    </td>
                    <td className="px-4 py-4 text-status-warning">
                      {formatCommissionMoney(beneficiary.pendingAmount, locale)}
                    </td>
                    <td className="px-4 py-4 text-status-success">
                      {formatCommissionMoney(beneficiary.paidAmount, locale)}
                    </td>
                    <td className="px-4 py-4 text-content-muted">
                      {formatDateTime(beneficiary.lastCreatedAt, locale)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Button
                        variant="primary"
                        size="default"
                        onClick={() => onViewAll(beneficiary.userId)}
                        type="button"
                      >
                        {t("beneficiaries.actions.viewAll")}
                      </Button>
                    </td>
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
