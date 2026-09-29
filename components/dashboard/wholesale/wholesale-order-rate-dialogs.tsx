"use client";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DashboardFilterField,
  dashboardFilterInputClassName,
} from "@/components/dashboard/dashboard-section-panel";
import {
  deriveRmbAmountValue,
  deriveTransactionRateValue,
  formatEditableNumericValue,
} from "@/components/dashboard/admin-orders/admin-orders-utils";
import {
  findCnyExchangeRateByDate,
  getBeijingDateString,
  type ExchangeRateRow,
} from "@/lib/exchange-rates";
import type {
  WholesaleOrderListItem,
  WholesaleOrderSettlement,
} from "@/lib/wholesale";
import { formatCurrency, formatDate, formatRate } from "./wholesale-display";
import { WholesaleSubmitButton } from "./wholesale-ui";
type WholesaleOrderSettlementDialogProps = {
  exchangeRates: ExchangeRateRow[];
  onOpenChange: (open: boolean) => void;
  onSettleOrder: (formData: FormData) => Promise<boolean>;
  order: WholesaleOrderListItem;
  pending: boolean;
  settlements: WholesaleOrderSettlement[];
};
export function WholesaleOrderSettlementDialog({
  exchangeRates,
  onOpenChange,
  onSettleOrder,
  order,
  pending,
  settlements,
}: WholesaleOrderSettlementDialogProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_order_rate_dialogs",
  );
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementDate, setSettlementDate] = useState(getBeijingDateString());
  const settledAmount = useMemo(
    () =>
      settlements.reduce(
        (sum, settlement) => sum + Number(settlement.settlement_amount),
        0,
      ),
    [settlements],
  );
  const remainingAmount = Math.max(
    Number(order.customer_payment_amount) - settledAmount,
    0,
  );
  const selectedRate = useMemo(
    () =>
      findCnyExchangeRateByDate(
        exchangeRates,
        order.customer_payment_currency,
        settlementDate,
      ),
    [exchangeRates, order.customer_payment_currency, settlementDate],
  );
  const activeRateValue = formatEditableNumericValue(
    deriveTransactionRateValue(selectedRate?.daily_exchange_rate, order.customer_payment_currency),
  );
  const rmbPreview = deriveRmbAmountValue(
    Number(settlementAmount || 0),
    activeRateValue,
  );
  return (
    <DashboardDialog
      description={uiText("dialogDescription")}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSettlementAmount("");
          setSettlementDate(getBeijingDateString());
        }
        onOpenChange(nextOpen);
      }}
      open
      title={uiText("attribute001")}
    >
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const succeeded = await onSettleOrder(
            new FormData(event.currentTarget),
          );
          // 请求失败时保留金额和日期，避免用户重复录入结汇信息。
          if (!succeeded) return;
          setSettlementAmount("");
          setSettlementDate(getBeijingDateString());
          onOpenChange(false);
        }}
      >
        <FormControls.Input name="order_id" type="hidden" value={order.id} />
        <ReadOnlyRateField
          label={uiText("attribute002")}
          value={order.order_number}
        />
        <ReadOnlyRateField
          label={uiText("attribute003")}
          value={formatCurrency(
            order.customer_payment_amount,
            order.customer_payment_currency,
          )}
        />
        <ReadOnlyRateField
          label={uiText("attribute004")}
          value={formatCurrency(
            remainingAmount,
            order.customer_payment_currency,
          )}
        />
        <DashboardFilterField label={uiText("attribute005")}>
          <FormControls.Input
            className={dashboardFilterInputClassName}
            max={remainingAmount}
            min={0.01}
            name="settlement_amount"
            onChange={(event) => setSettlementAmount(event.target.value)}
            placeholder={uiText("attribute006")}
            required
            step="0.01"
            type="number"
            value={settlementAmount}
          />
          <p className="mt-2 text-xs leading-5 text-content-muted">
            <UiMessage id="components_dashboard_wholesale_wholesale_order_rate_dialogs.text001" />
          </p>
        </DashboardFilterField>
        <DashboardFilterField label={uiText("attribute007")}>
          <DatePicker
            name="settlement_date"
            onValueChange={setSettlementDate}
            required
            value={settlementDate}
          />
          <p className="mt-2 text-xs leading-5 text-content-muted">
            <UiMessage id="components_dashboard_wholesale_wholesale_order_rate_dialogs.text002" />
          </p>
        </DashboardFilterField>
        <ReadOnlyRateField
          label={uiText("attribute008")}
          value={activeRateValue || "这个日期暂无汇率"}
        />
        <ReadOnlyRateField
          label={uiText("attribute009")}
          value={
            rmbPreview
              ? formatCurrency(Number(rmbPreview))
              : "填写金额且匹配到汇率后显示"
          }
        />
        <div className="md:col-span-2">
          <SettlementRecordList
            currency={order.customer_payment_currency}
            settlements={settlements}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
          <WholesaleSubmitButton pending={pending}>
            <UiMessage id="components_dashboard_wholesale_wholesale_order_rate_dialogs.text003" />
          </WholesaleSubmitButton>
        </div>
      </form>
    </DashboardDialog>
  );
}
function ReadOnlyRateField({ label, value }: { label: string; value: string }) {
  return (
    <DashboardFilterField label={label}>
      <div className="min-h-11 rounded-control-default border border-border-subtle bg-surface-interactive px-4 py-3 text-sm leading-5 text-content-strong [overflow-wrap:anywhere]">
        {value}
      </div>
    </DashboardFilterField>
  );
}
function SettlementRecordList({
  currency,
  settlements,
}: {
  currency: string;
  settlements: WholesaleOrderSettlement[];
}) {
  if (settlements.length === 0) {
    return (
      <div className="rounded-control-default border border-border-subtle bg-surface-interactive px-4 py-3 text-sm leading-6 text-content-muted">
        <UiMessage id="components_dashboard_wholesale_wholesale_order_rate_dialogs.text004" />
      </div>
    );
  }
  return (
    <div className="rounded-control-default border border-border-subtle bg-surface-interactive p-3">
      <p className="mb-2 text-xs font-semibold text-content-muted">
        <UiMessage id="components_dashboard_wholesale_wholesale_order_rate_dialogs.text005" />
      </p>
      <div className="grid gap-2">
        {settlements.map((settlement) => (
          <div
            className="grid gap-1 rounded-option bg-surface-inset p-3 text-xs leading-5 text-content-muted sm:grid-cols-4"
            key={settlement.id}
          >
            <span>{formatDate(settlement.settled_on)}</span>
            <span>
              {formatCurrency(settlement.settlement_amount, currency)}
            </span>
            <span>
              <UiMessage id="components_dashboard_wholesale_wholesale_order_rate_dialogs.text006" />
              {formatRate(settlement.settlement_exchange_rate)}
            </span>
            <span>{formatCurrency(settlement.settlement_rmb_amount)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
