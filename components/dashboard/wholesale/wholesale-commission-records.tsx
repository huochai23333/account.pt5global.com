"use client";

import { StatusBadge } from "@/components/ui/status-badge";
import { RecordCard } from "@/components/ui/data-display";

import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { useTranslations } from "next-intl";
import { UiMessage } from "@/components/i18n/ui-message";
import { DashboardTableFrame } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import type {
  WholesaleCommission,
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleProfile,
} from "@/lib/wholesale";
import {
  formatCurrency,
  formatDateTime,
  formatPercent,
  getCustomerName,
  getProfileName,
  WHOLESALE_STATUS_LABELS,
} from "./wholesale-display";
import { WholesaleTd, WholesaleTh } from "./wholesale-ui";
type WholesaleCommissionRecordsProps = {
  canAdmin: boolean;
  commissions: WholesaleCommission[];
  customersById: Map<string, WholesaleCustomer>;
  onSettleCommission: (commissionId: string) => void;
  orderById: Map<string, WholesaleOrder>;
  pendingKey: string | null;
  profilesById: Map<string, WholesaleProfile>;
};
function getCommissionTone(status: WholesaleCommission["status"]) {
  if (status === "settled") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  return "warning" as const;
}
// 桌面表格与移动卡片只负责展示已经筛选好的记录，筛选状态留在上层页面管理。
export function WholesaleCommissionRecords({
  canAdmin,
  commissions,
  customersById,
  onSettleCommission,
  orderById,
  pendingKey,
  profilesById,
}: WholesaleCommissionRecordsProps) {
  const t = useTranslations("WholesaleBusiness.orderFees");
  return (
    <>
      <ResponsiveDataView
        desktop={
          <>
            <DashboardTableFrame>
              <table className="w-full min-w-[980px] table-fixed border-collapse text-left text-sm">
                <colgroup>
                  <col className="w-[18%]" />
                  <col className="w-[16%]" />
                  <col className="w-[16%]" />
                  <col className="w-[14%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <thead>
                  <tr>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_commission_records.text001" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_commission_records.text002" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_commission_records.text003" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_commission_records.text004" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_commission_records.text005" />
                    </WholesaleTh>
                    <WholesaleTh className="whitespace-normal">
                      <UiMessage id="components_dashboard_wholesale_wholesale_commission_records.text006" />
                    </WholesaleTh>
                    {canAdmin ? (
                      <WholesaleTh className="whitespace-normal">
                        <UiMessage id="components_dashboard_wholesale_wholesale_commission_records.text007" />
                      </WholesaleTh>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((commission) => {
                    const order = orderById.get(commission.order_id);
                    return (
                      <tr key={commission.id}>
                        <WholesaleTd className="whitespace-normal">
                          <p className="font-semibold">
                            {order?.order_number ?? "未找到订单"}
                          </p>
                          <p className="mt-1 text-xs text-content-muted">
                            {formatDateTime(commission.calculated_at)}
                          </p>
                        </WholesaleTd>
                        <WholesaleTd className="whitespace-normal">
                          {getCustomerName(
                            customersById,
                            commission.customer_id,
                          )}
                        </WholesaleTd>
                        <WholesaleTd className="whitespace-normal">
                          {getProfileName(
                            profilesById,
                            commission.beneficiary_user_id,
                          )}
                        </WholesaleTd>
                        <WholesaleTd className="whitespace-normal">
                          <p>
                            {formatCurrency(
                              commission.order_payment_rmb_amount,
                            )}
                          </p>
                          <p className="mt-1 text-xs text-content-muted">
                            {t(commission.commission_basis === "service_fee" ? "serviceFeeCommission" : "grossProfitCommission")}：{formatCurrency(commission.commission_basis_amount_rmb)}
                          </p>
                        </WholesaleTd>
                        <WholesaleTd className="whitespace-normal">
                          <p>
                            {formatCurrency(commission.commission_amount_rmb)}
                          </p>
                          <p className="mt-1 text-xs text-content-muted">
                            {formatPercent(commission.commission_rate)}
                          </p>
                        </WholesaleTd>
                        <WholesaleTd className="whitespace-normal">
                          <StatusBadge
                            tone={getCommissionTone(commission.status)}
                          >
                            {WHOLESALE_STATUS_LABELS[commission.status]}
                          </StatusBadge>
                        </WholesaleTd>
                        {canAdmin ? (
                          <WholesaleTd className="whitespace-normal">
                            <SettleButton
                              commission={commission}
                              onSettleCommission={onSettleCommission}
                              pendingKey={pendingKey}
                            />
                          </WholesaleTd>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </DashboardTableFrame>
          </>
        }
        mobile={
          <>
            {commissions.map((commission) => {
              const order = orderById.get(commission.order_id);
              return (
                <RecordCard key={commission.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-content-strong">
                        {order?.order_number ?? "未找到订单"}
                      </p>
                      <p className="mt-1 break-words text-sm text-content-muted">
                        {getCustomerName(customersById, commission.customer_id)}
                      </p>
                    </div>
                    <StatusBadge tone={getCommissionTone(commission.status)}>
                      {WHOLESALE_STATUS_LABELS[commission.status]}
                    </StatusBadge>
                  </div>
                  <div className="mt-3 grid gap-2 break-words text-sm text-content-muted">
                    <p>
                      <UiMessage id="components_dashboard_wholesale_wholesale_commission_records.text009" />
                      {getProfileName(
                        profilesById,
                        commission.beneficiary_user_id,
                      )}
                    </p>
                    <p>
                      <UiMessage id="components_dashboard_wholesale_wholesale_commission_records.text010" />
                      {formatCurrency(commission.order_payment_rmb_amount)}
                    </p>
                    <p>
                      {t(commission.commission_basis === "service_fee" ? "serviceFeeCommission" : "grossProfitCommission")}：{formatCurrency(commission.commission_basis_amount_rmb)}
                    </p>
                    <p>
                      <UiMessage id="components_dashboard_wholesale_wholesale_commission_records.text012" />
                      {formatCurrency(commission.commission_amount_rmb)}（
                      {formatPercent(commission.commission_rate)}）
                    </p>
                  </div>
                  {canAdmin ? (
                    <SettleButton
                      className="mt-4"
                      commission={commission}
                      onSettleCommission={onSettleCommission}
                      pendingKey={pendingKey}
                    />
                  ) : null}
                </RecordCard>
              );
            })}
          </>
        }
      />
    </>
  );
}
function SettleButton({
  className = "",
  commission,
  onSettleCommission,
  pendingKey,
}: {
  className?: string;
  commission: WholesaleCommission;
  onSettleCommission: (commissionId: string) => void;
  pendingKey: string | null;
}) {
  return (
    <Button
      className={className}
      disabled={
        commission.status !== "pending" || pendingKey === "commission:settle"
      }
      onClick={() => onSettleCommission(commission.id)}
      size="compact"
      type="button"
      variant="primary"
    >
      <UiMessage id="components_dashboard_wholesale_wholesale_commission_records.text013" />
    </Button>
  );
}
