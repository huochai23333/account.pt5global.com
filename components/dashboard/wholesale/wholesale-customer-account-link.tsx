"use client";

import { Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { DashboardFilterField } from "@/components/dashboard/dashboard-section-panel";
import { FeedbackNotice } from "@/components/ui/feedback-notice";
import { Input } from "@/components/ui/form-controls";
import { Select } from "@/components/ui/select";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";

import type { SubmitWholesaleCustomerForm } from "./wholesale-customer-actions";
import { WholesaleEmptyState, WholesaleSubmitButton } from "./wholesale-ui";

type WholesaleCustomerAccountLinkProps = {
  canLink: boolean;
  customer: WholesaleCustomer;
  linkedUserIds: Set<string>;
  onLink: SubmitWholesaleCustomerForm;
  pending: boolean;
  registeredAccounts: WholesaleProfile[];
};

/** 候选账号已由数据库核对资格；已关联合并的档案只展示确认状态。 */
export function WholesaleCustomerAccountLink({
  canLink,
  customer,
  linkedUserIds,
  onLink,
  pending,
  registeredAccounts,
}: WholesaleCustomerAccountLinkProps) {
  const t = useTranslations("UiText.components_dashboard_wholesale_wholesale_customer_details");
  const [submitError, setSubmitError] = useState("");
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 手机的关联表单位于弹窗下方，失败提示随表单滚动，便于核对所选账号。
    if (submitError) feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [submitError]);
  if (customer.registered_user_id) {
    return (
      <p className="rounded-record-card border border-border-subtle bg-surface-inset px-4 py-3 text-sm leading-6 text-content-muted">
        {t("text003")}
      </p>
    );
  }
  if (!canLink) return null;

  const options = registeredAccounts
    .filter((profile) => !linkedUserIds.has(profile.user_id))
    .map((profile) => ({
      label: formatRegisteredCustomerAccount(profile, t("unnamedAccount")),
      value: profile.user_id,
    }));
  const fieldLabel = t("attribute001");

  return (
    <section className="rounded-record-card border border-border-subtle bg-surface-interactive p-4">
      <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold text-content-muted">
        <Link2 className="size-4 text-primary" />
        {t("text004")}
      </h4>
      {options.length > 0 ? (
        <form
          className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            setSubmitError("");
            await onLink(new FormData(event.currentTarget), setSubmitError);
          }}
        >
          <Input name="customer_id" type="hidden" value={customer.id} />
          <DashboardFilterField label={fieldLabel}>
            <Select
              aria-label={fieldLabel}
              name="registered_user_id"
              options={[{ label: t("text005"), value: "" }, ...options]}
              required
            />
          </DashboardFilterField>
          <div className="flex items-end justify-end">
            <WholesaleSubmitButton pending={pending}>{t("text006")}</WholesaleSubmitButton>
          </div>
          <p className="text-sm leading-6 text-content-muted sm:col-span-2">{t("text007")}</p>
          {submitError ? (
            <div className="sm:col-span-2" ref={feedbackRef}>
              <FeedbackNotice density="compact" tone="error">{submitError}</FeedbackNotice>
            </div>
          ) : null}
        </form>
      ) : (
        <WholesaleEmptyState
          description={t("attribute002")}
          icon={<Link2 className="size-5" />}
          title={t("attribute003")}
        />
      )}
    </section>
  );
}

export function formatRegisteredCustomerAccount(profile: WholesaleProfile, unnamed: string) {
  const name = profile.name?.trim() || unnamed;
  const contact = [profile.email, profile.phone].filter(Boolean).join(" / ");
  return contact ? `${name} (${contact})` : name;
}
