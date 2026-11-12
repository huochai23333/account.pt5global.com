"use client";

import { useTranslations } from "next-intl";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { DashboardFilterField } from "@/components/dashboard/dashboard-section-panel";
import { UiMessage } from "@/components/i18n/ui-message";
import { Select } from "@/components/ui/select";
import type { WholesaleCustomer } from "@/lib/wholesale";
import { WholesaleSubmitButton } from "./wholesale-ui";

// 推荐关系由上层执行并核对保存结果。失败时留在弹窗，保留原来的两项选择。
export function WholesaleReferralsDialog({ customers, onCreateReferral, onOpenChange, open, pending }: {
  customers: WholesaleCustomer[];
  onCreateReferral: (formData: FormData) => Promise<boolean>;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  pending: boolean;
}) {
  const uiText = useTranslations("UiText.components_dashboard_wholesale_wholesale_referrals_section");
  const customerOptions = customers.map((customer) => ({
    label: customer.unique_name,
    value: customer.id,
  }));

  return (
    <DashboardDialog
      description={uiText("attribute009")}
      onOpenChange={onOpenChange}
      open={open}
      title={uiText("attribute010")}
    >
      <form
        className="grid gap-4 md:grid-cols-2"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const succeeded = await onCreateReferral(new FormData(form));
          // 保存失败时弹窗保持打开，两位客户的选择也继续保留。
          if (!succeeded) return;
          form.reset();
          onOpenChange(false);
        }}
      >
        <DashboardFilterField label={uiText("attribute011")}>
          <Select
            aria-label={uiText("attribute011")}
            name="referrer_customer_id"
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_referrals_section.text002" />
                ),
                value: "",
              },
              ...customerOptions,
            ]}
            required
          />
        </DashboardFilterField>
        <DashboardFilterField label={uiText("attribute012")}>
          <Select
            aria-label={uiText("attribute012")}
            name="referred_customer_id"
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_referrals_section.text003" />
                ),
                value: "",
              },
              ...customerOptions,
            ]}
            required
          />
        </DashboardFilterField>
        <div className="flex justify-end md:col-span-2">
          <WholesaleSubmitButton pending={pending}>
            <UiMessage id="components_dashboard_wholesale_wholesale_referrals_section.text004" />
          </WholesaleSubmitButton>
        </div>
      </form>
    </DashboardDialog>
  );
}
