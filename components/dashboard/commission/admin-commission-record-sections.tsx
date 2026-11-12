"use client";

import { StatusBadge } from "@/components/ui/status-badge";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import { useTranslations } from "next-intl";
import { Search } from "lucide-react";

import { useLocale } from "@/components/i18n/locale-provider";
import { Button } from "@/components/ui/button";
import { DashboardPaginationFooter } from "@/components/dashboard/dashboard-collection-section";
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

import {
  type AdminCommissionTableSectionProps,
  CommissionDetailLine,
  getCommissionSettlementTone,
} from "./admin-commission-record-utils";
import {
  formatCommissionMoney,
  formatNullableCommissionMoney,
  getCommissionCategoryLabel,
  getCommissionOrderStatusLabel,
  getCommissionRoleLabel,
  getCommissionSettlementStatusLabel,
} from "./commission-display";

// 分页输入已经取出当页记录，按钮只将选定记录交给管理操作 Hook。
export function AdminCommissionTableSection({
  onFocusOrderNumber,
  onMarkAsPaid,
  pagination,
  rows,
  settlingCommissionId,
}: AdminCommissionTableSectionProps) {
  const t = useTranslations("Commission");
  const sharedT = useTranslations("DashboardShared");
  const { locale } = useLocale();
  const sharedCopy = createDashboardSharedCopy(sharedT);

  return (
    <DashboardListSection
      title={t("table.title")}
    >
      {rows.length === 0 ? (
        <EmptyState
          description={t("table.emptyDescription")}
          icon={<Search className="size-6" />}
          title={t("table.emptyTitle")}
        />
      ) : (
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
          <table className="min-w-[1220px] w-full divide-y divide-border-subtle text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold tracking-[0.16em] text-content-muted uppercase">
                <th className="px-4 py-3">{t("table.columns.orderStatus")}</th>
                <th className="px-4 py-3">{t("table.columns.beneficiary")}</th>
                <th className="px-4 py-3">{t("table.columns.category")}</th>
                <th className="px-4 py-3">{t("table.columns.source")}</th>
                <th className="px-4 py-3">
                  {t("table.columns.amountSnapshot")}
                </th>
                <th className="px-4 py-3">
                  {t("table.columns.commissionSettlement")}
                </th>
                <th className="px-4 py-3">{t("table.columns.timestamps")}</th>
                <th className="px-4 py-3 text-right">
                  {t("table.columns.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {pagination.items.map((commission) => {
                const beneficiaryStatus = mapUserStatus(
                  commission.beneficiary.status,
                  sharedCopy,
                );
                const isSettling = settlingCommissionId === commission.id;

                return (
                  <tr
                    key={commission.id}
                    className="align-top transition-colors hover:bg-surface-inset"
                  >
                    <td className="px-4 py-4">
                      <DesignButton
                        className="text-left text-sm font-semibold text-primary transition-colors hover:text-content-muted"
                        onClick={() =>
                          onFocusOrderNumber(commission.orderNumber)
                        }
                        type="button"
                      >
                        {commission.orderNumber}
                      </DesignButton>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge tone="info">
                          {getCommissionOrderStatusLabel(
                            commission.orderStatus,
                            t,
                          )}
                        </StatusBadge>
                        {commission.isOrderDeleted ? (
                          <StatusBadge tone="warning">
                            {t("shared.deletedOrder")}
                          </StatusBadge>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-medium text-content-strong">
                        {commission.beneficiary.label}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <StatusBadge tone="info">
                          {getCommissionRoleLabel(
                            commission.beneficiary.role,
                            t,
                          )}
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
                    <td className="px-4 py-4 font-medium text-content-strong">
                      {getCommissionCategoryLabel(commission.category, t)}
                    </td>
                    <td className="px-4 py-4">
                      <CommissionDetailLine
                        label={t("shared.fields.customer")}
                        value={
                          commission.sourceCustomer?.label ??
                          t("shared.fallback.none")
                        }
                      />
                      <CommissionDetailLine
                        label={t("shared.fields.salesman")}
                        value={
                          commission.sourceSalesman?.label ??
                          t("shared.fallback.none")
                        }
                      />
                    </td>
                    <td className="px-4 py-4">
                      <CommissionDetailLine
                        label={t("shared.fields.orderAmount")}
                        value={formatCommissionMoney(
                          commission.orderAmountRmb,
                          locale,
                        )}
                      />
                      <CommissionDetailLine
                        label={t("shared.fields.costAmount")}
                        value={formatNullableCommissionMoney(
                          commission.costAmountRmb,
                          locale,
                          t,
                        )}
                      />
                      <CommissionDetailLine
                        label={t("shared.fields.serviceFee")}
                        value={formatNullableCommissionMoney(
                          commission.serviceFeeAmountRmb,
                          locale,
                          t,
                        )}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-content-strong">
                        {formatCommissionMoney(
                          commission.commissionAmountRmb,
                          locale,
                        )}
                      </div>
                      <div className="mt-2">
                        <StatusBadge
                          tone={getCommissionSettlementTone(
                            commission.settlementStatus,
                          )}
                        >
                          {getCommissionSettlementStatusLabel(
                            commission.settlementStatus,
                            t,
                          )}
                        </StatusBadge>
                      </div>
                      {commission.settlementNote ? (
                        <p className="mt-2 max-w-xs text-xs leading-6 text-content-muted">
                          {t("shared.note", {
                            note: commission.settlementNote,
                          })}
                        </p>
                      ) : null}
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
                    <td className="px-4 py-4 text-right">
                      {commission.settlementStatus === "pending" ? (
                        <Button
                          variant="success"
                          size="default"
                          disabled={isSettling}
                          onClick={() => onMarkAsPaid(commission)}
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
