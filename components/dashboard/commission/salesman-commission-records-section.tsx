"use client";

import { StatusBadge } from "@/components/ui/status-badge";

import { ReceiptText } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardPaginationFooter } from "@/components/dashboard/dashboard-collection-section";
import {
  DashboardListSection,
  DashboardTableFrame,
} from "@/components/dashboard/dashboard-section-panel";
import {
  EmptyState,
  formatDateTime,
} from "@/components/dashboard/dashboard-shared-ui";
import { useLocale } from "@/components/i18n/locale-provider";
import type {
  AdminCommissionRow,
} from "@/lib/admin-commission";
import type { useDashboardPagination } from "@/lib/use-dashboard-pagination";

import {
  formatCommissionMoney,
  getCommissionCategoryLabel,
  getCommissionOrderStatusLabel,
  getCommissionOriginText,
  getCommissionSettlementStatusLabel,
} from "./commission-display";
import {
  CommissionDetailLine,
  getCommissionSettlementTone,
} from "./admin-commission-record-utils";

type CommissionPagination = ReturnType<
  typeof useDashboardPagination<AdminCommissionRow>
>;

/** 普通佣金记录的表格和空状态单独成区块，页面 Client 不直接渲染行数据。 */
export function SalesmanCommissionRecordsSection({
  commissions,
  pagination,
}: {
  commissions: AdminCommissionRow[];
  pagination: CommissionPagination;
}) {
  const t = useTranslations("Commission");
  const { locale } = useLocale();

  if (commissions.length === 0) {
    return (
      <DashboardListSection>
        <EmptyState
          description={t("salesman.states.emptyDescription")}
          icon={<ReceiptText className="size-6" />}
          title={t("salesman.states.emptyTitle")}
        />
      </DashboardListSection>
    );
  }

  return (
    <DashboardListSection ariaLabel={t("salesman.table.title")}>
      <DashboardTableFrame
        footer={
          <DashboardPaginationFooter
            endIndex={pagination.endIndex}
            hasNextPage={pagination.hasNextPage}
            hasPreviousPage={pagination.hasPreviousPage}
            onNextPage={pagination.goToNextPage}
            onPreviousPage={pagination.goToPreviousPage}
            page={pagination.page}
            pageCount={pagination.pageCount}
            startIndex={pagination.startIndex}
            totalItems={pagination.totalItems}
          />
        }
      >
        <table className="w-full min-w-[980px] divide-y divide-border-subtle text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold tracking-[0.16em] text-content-muted uppercase">
              <th className="px-4 py-3">
                {t("salesman.table.columns.origin")}
              </th>
              <th className="px-4 py-3">
                {t("salesman.table.columns.orderCustomer")}
              </th>
              <th className="px-4 py-3">
                {t("salesman.table.columns.category")}
              </th>
              <th className="px-4 py-3">
                {t("salesman.table.columns.amount")}
              </th>
              <th className="px-4 py-3">
                {t("salesman.table.columns.settlement")}
              </th>
              <th className="px-4 py-3">{t("salesman.table.columns.time")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {pagination.items.map((commission) => (
              <tr
                className="align-top transition-colors hover:bg-surface-inset"
                key={commission.id}
              >
                <td className="px-4 py-4">
                  <div className="max-w-sm text-sm leading-7 text-content-strong">
                    {getCommissionOriginText(commission, t)}
                  </div>
                  {commission.settlementNote ? (
                    <p className="mt-2 max-w-sm text-xs leading-6 text-content-muted">
                      {t("shared.note", { note: commission.settlementNote })}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-4">
                  <CommissionDetailLine
                    label={t("shared.fields.orderNumber")}
                    value={commission.orderNumber}
                  />
                  <CommissionDetailLine
                    label={t("shared.fields.customer")}
                    value={
                      commission.sourceCustomer?.label ??
                      t("shared.fallback.none")
                    }
                  />
                </td>
                <td className="px-4 py-4">
                  <div className="font-medium text-content-strong">
                    {getCommissionCategoryLabel(commission.category, t)}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge tone="info">
                      {getCommissionOrderStatusLabel(commission.orderStatus, t)}
                    </StatusBadge>
                    {commission.isOrderDeleted ? (
                      <StatusBadge tone="warning">
                        {t("shared.deletedOrder")}
                      </StatusBadge>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="font-semibold text-content-strong">
                    {formatCommissionMoney(
                      commission.commissionAmountRmb,
                      locale,
                    )}
                  </div>
                  <div className="mt-2 text-xs leading-6 text-content-muted">
                    {t("salesman.table.amountHint", {
                      amount: formatCommissionMoney(
                        commission.orderAmountRmb,
                        locale,
                      ),
                    })}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <StatusBadge
                    tone={getCommissionSettlementTone(commission.settlementStatus)}
                  >
                    {getCommissionSettlementStatusLabel(
                      commission.settlementStatus,
                      t,
                    )}
                  </StatusBadge>
                </td>
                <td className="px-4 py-4">
                  <CommissionDetailLine
                    label={t("shared.fields.createdAt")}
                    value={formatDateTime(commission.createdAt, locale)}
                  />
                  <CommissionDetailLine
                    label={t("shared.fields.settledAt")}
                    value={formatDateTime(commission.settledAt, locale)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DashboardTableFrame>
    </DashboardListSection>
  );
}
