"use client";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  DashboardFilterField,
  dashboardFilterInputClassName,
} from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import type { WholesaleCustomer } from "@/lib/wholesale";
import { WholesaleSubmitButton } from "./wholesale-ui";
type WholesaleCustomerOtherNamesProps = {
  canEdit: boolean;
  customer: WholesaleCustomer;
  onAddOtherName: (formData: FormData) => Promise<boolean>;
  pending: boolean;
};
export function WholesaleCustomerOtherNames({
  canEdit,
  customer,
  onAddOtherName,
  pending,
}: WholesaleCustomerOtherNamesProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_customer_other_names",
  );
  const [isAdding, setIsAdding] = useState(false);
  return (
    <section className="rounded-record-card border border-border-subtle bg-surface-interactive p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-content-muted">
            <UiMessage id="components_dashboard_wholesale_wholesale_customer_other_names.text001" />
          </h4>
          <p className="mt-1 text-xs leading-5 text-content-muted">
            <UiMessage id="components_dashboard_wholesale_wholesale_customer_other_names.text002" />
          </p>
        </div>
        {canEdit ? (
          <Button
            size="compact"
            onClick={() => setIsAdding((current) => !current)}
            type="button"
            variant="outline"
          >
            {isAdding ? (
              <X className="size-3.5" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {isAdding ? uiText("collapse") : uiText("open")}
          </Button>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {customer.other_names.length > 0 ? (
          customer.other_names.map((name) => (
            <span
              className="rounded-full bg-surface-inset px-3 py-1 text-xs leading-5 text-content-muted"
              key={name}
            >
              {name}
            </span>
          ))
        ) : (
          <p className="text-sm leading-6 text-content-muted">
            <UiMessage id="components_dashboard_wholesale_wholesale_customer_other_names.text003" />
          </p>
        )}
      </div>

      {isAdding ? (
        <form
          className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const succeeded = await onAddOtherName(new FormData(form));
            // 写入失败时保留输入框和别名，避免用户再次输入。
            if (!succeeded) return;
            form.reset();
            setIsAdding(false);
          }}
        >
          <FormControls.Input
            name="customer_id"
            type="hidden"
            value={customer.id}
          />
          <DashboardFilterField label={uiText("attribute001")}>
            <FormControls.Input
              className={dashboardFilterInputClassName}
              name="other_names"
              placeholder={uiText("attribute002")}
              required
            />
          </DashboardFilterField>
          <div className="flex items-end justify-end">
            <WholesaleSubmitButton pending={pending}>
              <UiMessage id="components_dashboard_wholesale_wholesale_customer_other_names.text004" />
            </WholesaleSubmitButton>
          </div>
        </form>
      ) : null}
    </section>
  );
}
