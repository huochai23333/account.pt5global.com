"use client";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
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
  type ExchangeRateRow,
} from "@/lib/exchange-rates";
import type {
  WholesaleOrderListItem,
  WholesaleOrderSettlement,
} from "@/lib/wholesale";
import { formatCurrency, formatDate, formatRate } from "./wholesale-display";
import { useWholesaleSettlementDraft } from "./use-wholesale-settlement-draft";
type WholesaleOrderSettlementDialogProps = {
  exchangeRates: ExchangeRateRow[];
  onOpenChange: (open: boolean) => void;
  onSettleOrder: (formData: FormData) => Promise<boolean>;
  order: WholesaleOrderListItem;
  pending: boolean;
  settlements: WholesaleOrderSettlement[];
  viewerId: string;
};
export function WholesaleOrderSettlementDialog({
  exchangeRates,
  onOpenChange,
  onSettleOrder,
  order,
  pending,
  settlements,
  viewerId,
}: WholesaleOrderSettlementDialogProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_order_rate_dialogs",
  );
  const draft = useWholesaleSettlementDraft(order.id, viewerId, onSettleOrder);
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
        draft.date,
      ),
    [exchangeRates, order.customer_payment_currency, draft.date],
  );
  const activeRateValue = formatEditableNumericValue(
    deriveTransactionRateValue(selectedRate?.daily_exchange_rate, order.customer_payment_currency),
  );
  const rmbPreview = deriveRmbAmountValue(
    Number(draft.amount || 0),
    activeRateValue,
  );
  return (
    <DashboardDialog
      description={uiText("dialogDescription")}
      onOpenChange={(nextOpen) => {
        // 登记执行时保留弹窗和本次输入，避免用户误把提交当作取消。
        if (!nextOpen && draft.submitting) return;
        onOpenChange(nextOpen);
      }}
      open
      title={uiText("attribute001")}
    >
      <form
        // 窄屏网格允许列宽小于长文案的自然宽度，字段和提示可在栏内换行。
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (await draft.submit(event.currentTarget)) onOpenChange(false);
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
            max={draft.matchesRestoredDraft ? undefined : remainingAmount}
            min={0.01}
            name="settlement_amount"
            onChange={(event) => draft.setAmount(event.target.value)}
            placeholder={uiText("attribute006")}
            required
            step="0.01"
            type="number"
            value={draft.amount}
          />
          <p className="mt-2 text-xs leading-5 text-content-muted">
            <UiMessage id="components_dashboard_wholesale_wholesale_order_rate_dialogs.text001" />
          </p>
        </DashboardFilterField>
        <DashboardFilterField label={uiText("attribute007")}>
          <DatePicker
            name="settlement_date"
            onValueChange={draft.setDate}
            required
            value={draft.date}
          />
          <p className="mt-2 text-xs leading-5 text-content-muted">
            <UiMessage id="components_dashboard_wholesale_wholesale_order_rate_dialogs.text002" />
          </p>
        </DashboardFilterField>
        <ReadOnlyRateField
          label={uiText("attribute008")}
          value={activeRateValue || uiText("noRateForDate")}
        />
        <ReadOnlyRateField
          label={uiText("attribute009")}
          value={
            rmbPreview
              ? formatCurrency(Number(rmbPreview))
              : uiText("previewUnavailable")
          }
        />
        <div className="md:col-span-2">
          <SettlementRecordList
            currency={order.customer_payment_currency}
            settlements={settlements}
          />
        </div>
        <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
          <Button
            className="max-w-full"
            variant="primary"
            size="large"
            loading={pending || draft.submitting}
            type="submit"
            wrap
          >
            <UiMessage id="components_dashboard_wholesale_wholesale_order_rate_dialogs.text003" />
          </Button>
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
