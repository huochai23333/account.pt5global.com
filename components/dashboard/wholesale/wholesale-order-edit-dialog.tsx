"use client";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import {
  DashboardFilterField,
  dashboardFilterInputClassName,
} from "@/components/dashboard/dashboard-section-panel";
import {
  buildOrderCurrencyOptions,
  formatEditableNumericValue,
} from "@/components/dashboard/admin-orders/admin-orders-utils";
import type { ExchangeRateRow } from "@/lib/exchange-rates";
import type {
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleProfile,
} from "@/lib/wholesale";
import {
  dedupeWholesaleCurrencyOptions,
  WHOLESALE_PAYMENT_PLATFORM_OPTIONS,
} from "./wholesale-order-form-options";
import {
  hasWholesaleOrderFieldChanges,
  toMonthInputValue,
} from "./wholesale-order-edit-form-utils";
import {
  WholesaleField,
  WholesaleSubmitButton,
} from "./wholesale-ui";
type WholesaleOrderEditDialogProps = {
  canReassignOrder: boolean;
  customers: WholesaleCustomer[];
  exchangeRates: ExchangeRateRow[];
  onOpenChange: (open: boolean) => void;
  onUpdateOrder: (formData: FormData) => Promise<boolean>;
  open: boolean;
  order: WholesaleOrder | null;
  pending: boolean;
  salesAccounts: WholesaleProfile[];
};
export function WholesaleOrderEditDialog({
  canReassignOrder,
  customers,
  exchangeRates,
  onOpenChange,
  onUpdateOrder,
  open,
  order,
  pending,
  salesAccounts,
}: WholesaleOrderEditDialogProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_order_edit_dialog",
  );
  const confirm = useDashboardConfirm();
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!open || !dirty) return;
    // 刷新或关闭浏览器时仍由浏览器提供最后一道草稿提醒。
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, open]);
  const currencyOptions = useWholesaleCurrencyOptions(exchangeRates, order);
  const defaultCurrency =
    order?.customer_payment_currency ??
    currencyOptions.find((option) => option.currency === "USD")?.currency ??
    currencyOptions[0]?.currency ??
    "CNY";
  if (!order) {
    return null;
  }
  return (
    <DashboardDialog
      description={uiText("description")}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && pending) return;
        if (!nextOpen && dirty) {
          void confirm({
            title: uiText("title"),
            description: uiText("discardDraftConfirm"),
            tone: "warning",
          }).then((accepted) => {
            if (accepted) { setDirty(false); onOpenChange(false); }
          });
          return;
        }
        onOpenChange(nextOpen);
      }}
      open={open}
      title={uiText("title")}
    >
      <form
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        key={order.id}
        onChange={() => setDirty(true)}
        onSubmit={async (event) => {
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const hasOrderChanges = hasWholesaleOrderFieldChanges(
            formData,
            order,
          );
          if (hasOrderChanges && !(await onUpdateOrder(formData))) return;
          // 没有修改时直接关闭；保存失败时保留输入，方便用户检查后重试。
          setDirty(false);
          onOpenChange(false);
        }}
      >
        <FormControls.Input name="order_id" type="hidden" value={order.id} />
        {!canReassignOrder ? (
          <>
            <FormControls.Input
              name="customer_id"
              type="hidden"
              value={order.customer_id}
            />
            <FormControls.Input
              name="sales_user_id"
              type="hidden"
              value={order.sales_user_id ?? ""}
            />
          </>
        ) : null}

        <DashboardFilterField label={uiText("attribute001")}>
          <Select
            aria-label={uiText("attribute001")}
            defaultValue={order.customer_id}
            disabled={!canReassignOrder}
            name="customer_id"
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_order_edit_dialog.text001" />
                ),
                value: "",
              },
              ...customers.map((customer) => ({
                label: customer.unique_name,
                value: customer.id,
              })),
            ]}
            required
          />
        </DashboardFilterField>
        <DashboardFilterField label={uiText("attribute002")}>
          <Select
            aria-label={uiText("attribute002")}
            defaultValue={order.sales_user_id ?? ""}
            disabled={!canReassignOrder}
            name="sales_user_id"
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_order_edit_dialog.text002" />
                ),
                value: "",
              },
              ...salesAccounts.map((profile) => ({
                label: profile.name || profile.email,
                value: profile.user_id,
              })),
            ]}
          />
        </DashboardFilterField>
        <WholesaleField
          defaultValue={order.small_order_count}
          label={uiText("attribute003")}
          min={0}
          name="small_order_count"
          required
          type="number"
        />
        <WholesaleField
          defaultValue={formatEditableNumericValue(
            order.product_purchase_amount,
          )}
          label={uiText("attribute004")}
          min={0}
          name="product_purchase_amount"
          required
          step="0.01"
          type="number"
        />
        <WholesaleField
          defaultValue={formatEditableNumericValue(
            order.international_shipping_fee,
          )}
          label={uiText("attribute005")}
          min={0}
          name="international_shipping_fee"
          required
          step="0.01"
          type="number"
        />
        <WholesaleField
          defaultValue={formatEditableNumericValue(order.other_fee)}
          label={uiText("attribute006")}
          min={0}
          name="other_fee"
          step="0.01"
          type="number"
        />
        <WholesaleField
          defaultValue={formatEditableNumericValue(
            order.referral_commission_fee,
          )}
          label={uiText("attribute007")}
          min={0}
          name="referral_commission_fee"
          step="0.01"
          type="number"
        />
        <WholesaleField
          defaultValue={order.courier_company ?? ""}
          label={uiText("attribute008")}
          name="courier_company"
        />
        <DashboardFilterField label={uiText("attribute009")}>
          <Select
            aria-label={uiText("attribute009")}
            defaultValue={defaultCurrency}
            name="customer_payment_currency"
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_order_edit_dialog.text003" />
                ),
                value: "",
              },
              ...currencyOptions.map((option) => ({
                label: option.currency,
                value: option.currency,
              })),
            ]}
            required
          />
        </DashboardFilterField>
        <WholesaleField
          defaultValue={formatEditableNumericValue(
            order.customer_payment_amount,
          )}
          label={uiText("attribute010")}
          min={0}
          name="customer_payment_amount"
          required
          step="0.01"
          type="number"
        />
        <DashboardFilterField label={uiText("attribute011")}>
          <Select
            aria-label={uiText("attribute011")}
            defaultValue={order.payment_platform ?? ""}
            name="payment_platform"
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_order_edit_dialog.text004" />
                ),
                value: "",
              },
              ...WHOLESALE_PAYMENT_PLATFORM_OPTIONS.map((platform) => ({
                label: platform,
                value: platform,
              })),
            ]}
          />
        </DashboardFilterField>
        <DashboardFilterField label={uiText("attribute012")}>
          <DatePicker
            defaultValue={toMonthInputValue(order.order_month)}
            mode="month"
            name="order_month"
            required
          />
        </DashboardFilterField>
        <div className="md:col-span-2 xl:col-span-4">
          <DashboardFilterField label={uiText("attribute013")}>
            <FormControls.Textarea
              className={`${dashboardFilterInputClassName} h-auto min-h-24 py-3 sm:h-auto`}
              defaultValue={order.notes ?? ""}
              name="notes"
            />
          </DashboardFilterField>
        </div>
        <div className="flex justify-end md:col-span-2 xl:col-span-4">
          <WholesaleSubmitButton pending={pending}>
            {uiText("saveAction")}
          </WholesaleSubmitButton>
        </div>
      </form>
    </DashboardDialog>
  );
}
function useWholesaleCurrencyOptions(
  exchangeRates: ExchangeRateRow[],
  order: WholesaleOrder | null,
) {
  return useMemo(() => {
    const options = dedupeWholesaleCurrencyOptions(
      buildOrderCurrencyOptions(exchangeRates),
    );
    const orderCurrency = order?.customer_payment_currency;
    const hasCny = options.some((option) => option.currency === "CNY");
    const nextOptions = hasCny
      ? [...options]
      : [
          ...options,
          {
            currency: "CNY",
            dailyExchangeRate: "1",
            transactionRate: "0.99",
          },
        ];
    const hasOrderCurrency =
      !orderCurrency ||
      nextOptions.some((option) => option.currency === orderCurrency);
    if (!hasOrderCurrency && orderCurrency) {
      nextOptions.push({
        currency: orderCurrency,
        dailyExchangeRate: formatEditableNumericValue(
          order?.settlement_exchange_rate,
        ),
        transactionRate: "",
      });
    }
    return nextOptions;
  }, [exchangeRates, order]);
}
