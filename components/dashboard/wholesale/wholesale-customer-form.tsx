"use client";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { DashboardFilterField } from "@/components/dashboard/dashboard-section-panel";
import { FeedbackNotice } from "@/components/ui/feedback-notice";
import { Select } from "@/components/ui/select";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import type { SubmitWholesaleCustomerForm } from "./wholesale-customer-actions";
import { getProfileName } from "./wholesale-display";
import {
  WholesaleField,
  WholesaleSubmitButton,
  WholesaleTextarea,
} from "./wholesale-ui";
type WholesaleCustomerFormProps = {
  canAssignSalesUser: boolean;
  currentUserId: string | null;
  customer?: WholesaleCustomer;
  mode: "create" | "edit";
  onSaved: () => void;
  onSubmit: SubmitWholesaleCustomerForm;
  pending: boolean;
  profilesById: Map<string, WholesaleProfile>;
  salesAccounts: WholesaleProfile[];
};
export function WholesaleCustomerForm({
  canAssignSalesUser,
  currentUserId,
  customer,
  mode,
  onSaved,
  onSubmit,
  pending,
  profilesById,
  salesAccounts,
}: WholesaleCustomerFormProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_customer_form",
  );
  const [submitError, setSubmitError] = useState("");
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 小屏弹窗内容可滚动，错误出现后将完整提示滚入视口并保留当前焦点。
    if (submitError) feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [submitError]);
  const fixedSalesUserId =
    mode === "create"
      ? currentUserId
      : (customer?.assigned_sales_user_id ?? null);
  const fixedSalesUserName = fixedSalesUserId
    ? getProfileName(profilesById, fixedSalesUserId, uiText("text001"))
    : uiText("text001");
  // 管理员自领线索生成的客户继续由管理员负责，编辑表单必须保留这一真实选项。
  // 此处只补入该客户现有的负责人，不修改订单和提成使用的业务员候选列表。
  const currentOwner = customer?.assigned_sales_user_id ? profilesById.get(customer.assigned_sales_user_id) : undefined;
  const ownerOptions = currentOwner?.role === "administrator" && !salesAccounts.some((account) => account.user_id === currentOwner.user_id)
    ? [currentOwner, ...salesAccounts] : salesAccounts;
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setSubmitError("");
    const saved = await onSubmit(new FormData(form), mode === "edit" ? setSubmitError : undefined);
    if (!saved) {
      return;
    }
    if (mode === "create") {
      form.reset();
    }
    onSaved();
  };
  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
      {customer ? (
        <>
          <FormControls.Input name="customer_id" type="hidden" value={customer.id} />
          {/* 使用打开表单时的档案快照，刷新目录不能悄悄替换待提交的版本。 */}
          <FormControls.Input
            name="expected_revision"
            type="hidden"
            value={customer.edit_revision}
          />
        </>
      ) : null}
      <WholesaleField
        defaultValue={customer?.unique_name}
        label={uiText("attribute001")}
        name="unique_name"
        required
      />
      {canAssignSalesUser ? (
        <DashboardFilterField label={uiText("attribute002")}>
          <Select
            aria-label={uiText("attribute002")}
            defaultValue={customer?.assigned_sales_user_id ?? ""}
            name="assigned_sales_user_id"
            options={[
              {
                label: (
                  <UiMessage id="components_dashboard_wholesale_wholesale_customer_form.text001" />
                ),
                value: "",
              },
              ...ownerOptions.map((profile) => ({
                label: profile.name || profile.email,
                value: profile.user_id,
              })),
            ]}
          />
        </DashboardFilterField>
      ) : (
        <div className="min-w-0 rounded-record-card border border-border-subtle bg-surface-interactive px-4 py-3">
          <FormControls.Input
            name="assigned_sales_user_id"
            type="hidden"
            value={fixedSalesUserId ?? ""}
          />
          <p className="text-xs font-semibold text-content-muted">
            <UiMessage id="components_dashboard_wholesale_wholesale_customer_form.text002" />
          </p>
          <p className="mt-2 break-words text-sm font-medium text-content-strong">
            {fixedSalesUserName}
          </p>
        </div>
      )}
      <div className="md:col-span-2">
        <WholesaleTextarea
          defaultValue={customer?.other_names.join("\n")}
          label={uiText("attribute003")}
          name="other_names"
          placeholder={uiText("attribute004")}
        />
      </div>
      <WholesaleField
        defaultValue={customer?.contact_details ?? undefined}
        label={uiText("attribute005")}
        name="contact_details"
      />
      <WholesaleField
        defaultValue={customer?.source ?? undefined}
        label={uiText("attribute006")}
        name="source"
      />
      <div className="md:col-span-2">
        <WholesaleTextarea
          defaultValue={customer?.notes ?? undefined}
          label={uiText("attribute007")}
          name="notes"
        />
      </div>
      {submitError ? (
        <div className="md:col-span-2" ref={feedbackRef}>
          <FeedbackNotice density="compact" tone="error">{submitError}</FeedbackNotice>
        </div>
      ) : null}
      <div className="flex justify-end md:col-span-2">
        <WholesaleSubmitButton pending={pending}>
          {mode === "create" ? uiText("saveNew") : uiText("saveChanges")}
        </WholesaleSubmitButton>
      </div>
    </form>
  );
}
