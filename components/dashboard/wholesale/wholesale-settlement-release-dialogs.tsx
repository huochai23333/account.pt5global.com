"use client";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Select } from "@/components/ui/select";
import {
  DashboardFilterField,
  dashboardFilterInputClassName,
} from "@/components/dashboard/dashboard-section-panel";
import type { WholesaleCustomer } from "@/lib/wholesale";
import { getBeijingDateString } from "@/lib/exchange-rates";
import { WholesaleSubmitButton, WholesaleTextarea } from "./wholesale-ui";
type CreateDialogProps = {
  currencyOptions: string[];
  customers: WholesaleCustomer[];
  onCreateRelease: (formData: FormData) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
};
export function WholesaleSettlementReleaseCreateDialog({
  currencyOptions,
  customers,
  onCreateRelease,
  onOpenChange,
  pending,
}: CreateDialogProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_settlement_release_dialogs",
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const selectedCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );
  return (
    <DashboardDialog
      description={uiText("attribute001")}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedCustomerId("");
          setManualCustomerName("");
        }
        onOpenChange(nextOpen);
      }}
      open
      title={uiText("attribute002")}
    >
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const succeeded = await onCreateRelease(
            new FormData(event.currentTarget),
          );
          // 发布失败时保留客户、金额、币种和备注，用户无需重新填写。
          if (!succeeded) return;
          onOpenChange(false);
        }}
      >
        <DashboardFilterField label={uiText("attribute003")}>
          <Select
            aria-label={uiText("attribute003")}
            name="customer_id"
            onValueChange={(value) => {
              setSelectedCustomerId(value);
              if (value) {
                setManualCustomerName("");
              }
            }}
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_dialogs.text001" />
                ),
                value: "",
              },
              ...customers.map((customer) => ({
                label: customer.unique_name,
                value: customer.id,
              })),
            ]}
            value={selectedCustomerId}
          />
        </DashboardFilterField>

        <DashboardFilterField label={uiText("attribute004")}>
          <FormControls.Input
            className={dashboardFilterInputClassName}
            disabled={Boolean(selectedCustomer)}
            name="customer_name"
            onChange={(event) => setManualCustomerName(event.target.value)}
            placeholder={uiText("attribute005")}
            required={!selectedCustomer}
            value={selectedCustomer?.unique_name ?? manualCustomerName}
          />
          <p className="mt-2 text-xs leading-5 text-content-muted">
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_dialogs.text002" />
          </p>
        </DashboardFilterField>

        <DashboardFilterField label={uiText("attribute006")}>
          <FormControls.Input
            className={dashboardFilterInputClassName}
            min={0.01}
            name="release_amount"
            placeholder={uiText("attribute007")}
            required
            step="0.01"
            type="number"
          />
        </DashboardFilterField>

        <DashboardFilterField label={uiText("attribute008")}>
          <Select
            aria-label={uiText("attribute008")}
            // 发布结汇款需要操作者明确选币种，排序后的首项不代表实际收款币种。
            defaultValue={null}
            name="release_currency"
            placeholder={uiText("selectCurrency")}
            options={currencyOptions.map((currency) => ({
              label: currency,
              value: currency,
            }))}
            required
          />
        </DashboardFilterField>

        <DashboardFilterField label={uiText("attribute009")}>
          <DatePicker
            defaultValue={getBeijingDateString()}
            name="received_on"
            required
          />
        </DashboardFilterField>

        <div className="md:col-span-2">
          <WholesaleTextarea
            label={uiText("attribute010")}
            name="note"
            placeholder={uiText("attribute011")}
          />
        </div>

        <div className="flex justify-end md:col-span-2">
          <WholesaleSubmitButton pending={pending}>
            <UiMessage id="components_dashboard_wholesale_wholesale_settlement_release_dialogs.text003" />
          </WholesaleSubmitButton>
        </div>
      </form>
    </DashboardDialog>
  );
}
