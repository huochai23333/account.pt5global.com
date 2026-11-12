"use client";

import { PencilLine, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { DocumentEntry } from "@/components/dashboard/document-library/document-entry";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";

import { formatRegisteredCustomerAccount, WholesaleCustomerAccountLink } from "./wholesale-customer-account-link";
import type { SubmitWholesaleCustomerForm } from "./wholesale-customer-actions";
import { WholesaleCustomerOtherNames } from "./wholesale-customer-other-names";
import { WholesaleDetailGrid } from "./wholesale-detail-grid";
import { getProfileName } from "./wholesale-display";

type WholesaleCustomerDetailsProps = {
  canEdit: boolean;
  canLinkAccount: boolean;
  customer: WholesaleCustomer;
  linkedRegisteredUserIds: Set<string>;
  onAddOtherName: (formData: FormData) => Promise<boolean>;
  onDeleteCustomer: () => void;
  onEditCustomer: () => void;
  onLinkRegisteredUser: SubmitWholesaleCustomerForm;
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
  const t = useTranslations("UiText.components_dashboard_wholesale_wholesale_customer_details");
  const directory = useTranslations("WholesaleBusiness.directoryUi");
  const locale = useLocale();
  const notRecorded = directory("fallbacks.notRecorded");
  const linkedProfile = customer.registered_user_id
    ? profilesById.get(customer.registered_user_id)
    : undefined;
  // 档案可能有已关联的用户编号，但当前账号没有读取该用户资料的权限。
  const linkedAccount = linkedProfile
    ? formatRegisteredCustomerAccount(linkedProfile, t("unnamedAccount"))
    : customer.registered_user_id ? t("linkedAccount") : directory("fallbacks.notLinked");
  const createdAt = new Date(customer.created_at);
  const createdDate = Number.isFinite(createdAt.getTime())
    ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit" }).format(createdAt)
    : notRecorded;

  const rows = [
    { label: t("uniqueName"), value: customer.unique_name },
    { label: t("contact"), value: customer.contact_details ?? notRecorded },
    { label: t("source"), value: customer.source ?? notRecorded },
    {
      label: t("ownerLabel"),
      value: getProfileName(profilesById, customer.assigned_sales_user_id, directory("fallbacks.unassigned")),
    },
    {
      label: t("customerKind"),
      value: <StatusBadge>{directory(`customerKinds.${customer.customer_kind}`)}</StatusBadge>,
    },
    { label: t("account"), value: linkedAccount },
    { label: t("registeredOn"), value: createdDate },
    { label: t("notes"), value: customer.notes ?? notRecorded },
  ];

  return (
    <div className="space-y-5">
      {/* 资料始终按客户档案编号查找，关联登录账号后仍打开同一档案。 */}
      <DocumentEntry customerId={customer.id} />
      {canEdit ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button size="compact" onClick={onEditCustomer} type="button" variant="outline">
            <PencilLine className="size-3.5" />
            {t("text001")}
          </Button>
          <Button
            size="compact"
            onClick={onDeleteCustomer}
            disabled={Boolean(customer.source_sales_lead_id)}
            type="button"
            variant="danger"
          >
            <Trash2 className="size-3.5" />
            {t("text002")}
          </Button>
        </div>
      ) : null}
      <WholesaleDetailGrid rows={rows} />
      {customer.source_sales_lead_id ? (
        <p className="text-sm leading-6 text-content-muted">{t("linkedLeadNotice")}</p>
      ) : null}
      <WholesaleCustomerOtherNames
        canEdit={canEdit}
        customer={customer}
        onAddOtherName={onAddOtherName}
        pending={pendingKey === `customer:add-other-name:${customer.id}`}
      />
      <WholesaleCustomerAccountLink
        canLink={canLinkAccount}
        customer={customer}
        linkedUserIds={linkedRegisteredUserIds}
        onLink={onLinkRegisteredUser}
        pending={pendingKey === `customer:link-account:${customer.id}`}
        registeredAccounts={registeredAccounts}
      />
    </div>
  );
}
