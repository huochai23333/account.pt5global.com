"use client";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
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
import type { SettlementReleasePublicationActions } from "./use-wholesale-settlement-release-publication";
type CreateDialogProps = {
  currencyOptions: string[];
  customers: WholesaleCustomer[];
  publication: SettlementReleasePublicationActions;
  onOpenChange: (open: boolean) => void;
  pending: boolean;
};
export function WholesaleSettlementReleaseCreateDialog({
  currencyOptions,
  customers,
  publication,
  onOpenChange,
  pending,
}: CreateDialogProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_settlement_release_dialogs",
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [manualCustomerName, setManualCustomerName] = useState("");
  const [needsCheck, setNeedsCheck] = useState(publication.hasPending);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const selectedCustomer = useMemo(
    () =>
      customers.find((customer) => customer.id === selectedCustomerId) ?? null,
    [customers, selectedCustomerId],
  );

  useEffect(() => {
    // 手机提交时往往已滚到表单底部，把待核对提示和按钮一起带回视口。
    if (feedback) feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [feedback]);

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
          setFeedback(null);
          const succeeded = await publication.create(
            new FormData(event.currentTarget),
            setFeedback,
          );
          if (succeeded) onOpenChange(false);
          else setNeedsCheck(publication.hasPending());
        }}
      >
        {needsCheck || feedback ? (
          <div
            className="space-y-3 rounded-record-card border border-border-subtle bg-surface-inset p-3 md:col-span-2"
            ref={feedbackRef}
          >
            {feedback ? <p role="alert" className="text-sm text-status-danger">{feedback}</p> : null}
            {needsCheck ? (
              <>
                <p className="text-sm text-content-muted">{uiText("publicationRecoveryHint")}</p>
                <Button
                  disabled={pending}
                  onClick={async () => {
                    setFeedback(null);
                    if (await publication.recover(setFeedback)) onOpenChange(false);
                  }}
                  type="button"
                  variant="outline"
                  wrap
                >
                  {uiText("recoverPublication")}
                </Button>
              </>
            ) : null}
          </div>
        ) : null}
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
