"use client";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";
import { DashboardFilterField } from "@/components/dashboard/dashboard-section-panel";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import { buildOrderCurrencyOptions } from "@/components/dashboard/admin-orders/admin-orders-utils";
import type { ExchangeRateRow } from "@/lib/exchange-rates";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import {
  WholesaleField,
  WholesaleSubmitButton,
  WholesaleTextarea,
} from "./wholesale-ui";
import {
  dedupeWholesaleCurrencyOptions,
  WHOLESALE_PAYMENT_PLATFORM_OPTIONS,
} from "./wholesale-order-form-options";
import { useWholesaleOrderCreateSubmission } from "./use-wholesale-order-create-submission";
type WholesaleOrderFormDialogProps = {
  customers: WholesaleCustomer[];
  exchangeRates: ExchangeRateRow[];
  onCreateOrder: (formData: FormData) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
  salesAccounts: WholesaleProfile[];
};
export function WholesaleOrderFormDialog({
  customers,
  exchangeRates,
  onCreateOrder,
  onOpenChange,
  open,
  pending,
  salesAccounts,
}: WholesaleOrderFormDialogProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_order_form_dialog",
  );
  const [dirty, setDirty] = useState(false);
  const confirm = useDashboardConfirm();
  useEffect(() => {
    if (!open || !dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty, open]);
  const submission = useWholesaleOrderCreateSubmission({
    onCreateOrder,
    onOpenChange,
    open,
    pending,
  });
  const currencyOptions = useMemo(() => {
    const options = dedupeWholesaleCurrencyOptions(
      buildOrderCurrencyOptions(exchangeRates),
    );
    return options.some((option) => option.currency === "CNY")
      ? options
      : [
          ...options,
          {
            currency: "CNY",
            dailyExchangeRate: "1",
            transactionRate: "0.99",
          },
        ];
  }, [exchangeRates]);
  const defaultCurrency =
    currencyOptions.find((option) => option.currency === "USD")?.currency ??
    currencyOptions[0]?.currency ??
    "CNY";
  return (
    <DashboardDialog
      description={uiText("attribute001")}
      onOpenChange={(nextOpen) => {
        // Escape、遮罩和关闭按钮都经过这里；保留输入直到用户明确选择放弃。
        if (!nextOpen && submission.pending) return;
        if (!nextOpen && dirty) {
          void confirm({
            title: uiText("attribute002"),
            description: uiText("discardDraftConfirm"),
            tone: "warning",
          }).then((accepted) => {
            if (!accepted) return;
            setDirty(false);
            submission.handleOpenChange(false);
          });
          return;
        }
        if (!nextOpen) setDirty(false);
        submission.handleOpenChange(nextOpen);
      }}
      open={open}
      title={uiText("attribute002")}
    >
      <form
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        onChange={() => setDirty(true)}
        onSubmit={async (event) => {
          event.preventDefault();
          if (await submission.submit(event.currentTarget)) setDirty(false);
        }}
      >
        <DashboardFilterField label={uiText("attribute003")} required>
          <Select
            aria-label={uiText("attribute003")}
            name="customer_id"
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_order_form_dialog.text001" />
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
        <DashboardFilterField label={uiText("attribute004")}>
          <Select
            aria-label={uiText("attribute004")}
            name="sales_user_id"
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_order_form_dialog.text002" />
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
          label={uiText("attribute005")}
          min={0}
          name="small_order_count"
          required
          type="number"
        />
        <WholesaleField
          label={uiText("attribute006")}
          min={0}
          name="product_purchase_amount"
          required
          step="0.01"
          type="number"
        />
        <WholesaleField
          label={uiText("attribute007")}
          min={0}
          name="international_shipping_fee"
          required
          step="0.01"
          type="number"
        />
        <WholesaleField
          label={uiText("attribute008")}
          min={0}
          name="other_fee"
          step="0.01"
          type="number"
        />
        <WholesaleField
          label={uiText("attribute009")}
          min={0}
          name="referral_commission_fee"
          step="0.01"
          type="number"
        />
        <WholesaleField label={uiText("attribute010")} name="courier_company" />
        <DashboardFilterField label={uiText("attribute011")} required>
          <Select
            aria-label={uiText("attribute011")}
            defaultValue={defaultCurrency}
            name="customer_payment_currency"
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_order_form_dialog.text003" />
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
          label={uiText("attribute012")}
          min={0}
          name="customer_payment_amount"
          required
          step="0.01"
          type="number"
        />
        <DashboardFilterField label={uiText("attribute013")}>
          <Select
            aria-label={uiText("attribute013")}
            name="payment_platform"
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_order_form_dialog.text004" />
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
        <DashboardFilterField label={uiText("attribute014")} required>
          <DatePicker mode="month" name="order_month" required />
        </DashboardFilterField>
        <div className="md:col-span-2 xl:col-span-4">
          <WholesaleTextarea label={uiText("attribute015")} name="notes" />
        </div>
        <div className="flex justify-end md:col-span-2 xl:col-span-4">
          <WholesaleSubmitButton pending={submission.pending}>
            <UiMessage id="components_dashboard_wholesale_wholesale_order_form_dialog.text005" />
          </WholesaleSubmitButton>
        </div>
      </form>
    </DashboardDialog>
  );
}
