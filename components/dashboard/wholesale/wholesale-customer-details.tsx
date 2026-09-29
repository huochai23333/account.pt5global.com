"use client";

import { StatusBadge } from "@/components/ui/status-badge";

import * as FormControls from "@/components/ui/form-controls";
import { UiMessage } from "@/components/i18n/ui-message";
import { useTranslations } from "next-intl";
import { Link2, PencilLine, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardFilterField } from "@/components/dashboard/dashboard-section-panel";
import { Select } from "@/components/ui/select";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import { WholesaleCustomerOtherNames } from "./wholesale-customer-other-names";
import { WholesaleDetailGrid } from "./wholesale-detail-grid";
import {
  formatDate,
  getProfileName,
  WHOLESALE_STATUS_LABELS,
} from "./wholesale-display";
import { WholesaleEmptyState, WholesaleSubmitButton } from "./wholesale-ui";
type WholesaleCustomerDetailsProps = {
  canEdit: boolean;
  canLinkAccount: boolean;
  customer: WholesaleCustomer;
  linkedRegisteredUserIds: Set<string>;
  onAddOtherName: (formData: FormData) => Promise<boolean>;
  onDeleteCustomer: () => void;
  onEditCustomer: () => void;
  onLinkRegisteredUser: (formData: FormData) => Promise<boolean>;
  pendingKey: string | null;
  profilesById: Map<string, WholesaleProfile>;
  registeredAccounts: WholesaleProfile[];
};
export function WholesaleCustomerDetails({
  canEdit,
  canLinkAccount,
  customer,
  linkedRegisteredUserIds,
  onAddOtherName,
  onDeleteCustomer,
  onEditCustomer,
  onLinkRegisteredUser,
  pendingKey,
  profilesById,
  registeredAccounts,
}: WholesaleCustomerDetailsProps) {
  const uiText = useTranslations(
    "UiText.components_dashboard_wholesale_wholesale_customer_details",
  );
  const linkedProfile = customer.registered_user_id
    ? profilesById.get(customer.registered_user_id)
    : null;
  const availableRegisteredAccounts = registeredAccounts.filter(
    (profile) => !linkedRegisteredUserIds.has(profile.user_id),
  );
  const rows = [
    { label: "客户唯一名称", value: customer.unique_name },
    { label: "联系方式", value: customer.contact_details ?? "未记录" },
    { label: "客户来源", value: customer.source ?? "未记录" },
    {
      label: uiText("ownerLabel"),
      value: getProfileName(profilesById, customer.assigned_sales_user_id),
    },
    {
      label: "客户类型",
      value: (
        <StatusBadge>
          {WHOLESALE_STATUS_LABELS[customer.customer_kind]}
        </StatusBadge>
      ),
    },
    {
      label: "关联注册账号",
      value: linkedProfile
        ? getRegisteredAccountLabel(linkedProfile)
        : "未关联",
    },
    { label: "登记时间", value: formatDate(customer.created_at) },
    { label: "备注", value: customer.notes ?? "未记录" },
  ];
  return (
    <div className="space-y-5">
      {canEdit ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            size="compact"
            onClick={onEditCustomer}
            type="button"
            variant="outline"
          >
            <PencilLine className="size-3.5" />
            <UiMessage id="components_dashboard_wholesale_wholesale_customer_details.text001" />
          </Button>
          <Button
            size="compact"
            onClick={onDeleteCustomer}
            disabled={Boolean(customer.source_sales_lead_id)}
            type="button"
            variant="danger"
          >
            <Trash2 className="size-3.5" />
            <UiMessage id="components_dashboard_wholesale_wholesale_customer_details.text002" />
          </Button>
        </div>
      ) : null}
      <WholesaleDetailGrid rows={rows} />
      {customer.source_sales_lead_id ? <p className="text-sm leading-6 text-content-muted"><UiMessage id="components_dashboard_wholesale_wholesale_customer_details.linkedLeadNotice" /></p> : null}
      <WholesaleCustomerOtherNames
        canEdit={canEdit}
        customer={customer}
        onAddOtherName={onAddOtherName}
        pending={pendingKey === `customer:add-other-name:${customer.id}`}
      />
      {customer.registered_user_id ? (
        <p className="rounded-record-card border border-border-subtle bg-surface-inset px-4 py-3 text-sm leading-6 text-content-muted">
          <UiMessage id="components_dashboard_wholesale_wholesale_customer_details.text003" />
        </p>
      ) : canLinkAccount ? (
        <div className="rounded-record-card border border-border-subtle bg-surface-interactive p-4">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-content-muted">
            <Link2 className="size-4 text-primary" />
            <UiMessage id="components_dashboard_wholesale_wholesale_customer_details.text004" />
          </div>
          {availableRegisteredAccounts.length > 0 ? (
            <form
              className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"
              onSubmit={async (event) => {
                event.preventDefault();
                // 关联失败时不改变当前选择，错误信息由页面统一反馈区展示。
                await onLinkRegisteredUser(new FormData(event.currentTarget));
              }}
            >
              <FormControls.Input
                name="customer_id"
                type="hidden"
                value={customer.id}
              />
              <DashboardFilterField label={uiText("attribute001")}>
                <Select
                  aria-label={uiText("attribute001")}
                  name="registered_user_id"
                  options={[
                    {
                      label: (
                        <UiMessage id="components_dashboard_wholesale_wholesale_customer_details.text005" />
                      ),
                      value: "",
                    },
                    ...availableRegisteredAccounts.map((profile) => ({
                      label: getRegisteredAccountLabel(profile),
                      value: profile.user_id,
                    })),
                  ]}
                  required
                />
              </DashboardFilterField>
              <div className="flex items-end justify-end">
                <WholesaleSubmitButton
                  pending={
                    pendingKey === `customer:link-account:${customer.id}`
                  }
                >
                  <UiMessage id="components_dashboard_wholesale_wholesale_customer_details.text006" />
                </WholesaleSubmitButton>
              </div>
              <p className="text-sm leading-6 text-content-muted sm:col-span-2">
                <UiMessage id="components_dashboard_wholesale_wholesale_customer_details.text007" />
              </p>
            </form>
          ) : (
            <WholesaleEmptyState
              description={uiText("attribute002")}
              icon={<Link2 className="size-5" />}
              title={uiText("attribute003")}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
function getRegisteredAccountLabel(profile: WholesaleProfile) {
  const displayName = profile.name?.trim() || "未填写姓名";
  const contact = [profile.email, profile.phone].filter(Boolean).join(" / ");
  return contact ? `${displayName}（${contact}）` : displayName;
}
