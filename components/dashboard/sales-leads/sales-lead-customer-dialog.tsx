"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DashboardFormField, DashboardFormTextarea, FormDialog } from "@/components/dashboard/dashboard-form-dialog";
import { Input } from "@/components/ui/form-controls";
import type { SalesLeadCustomerInput, SalesLeadDetail } from "@/lib/sales-leads-types";
import { createSalesLeadCustomerDraft, splitSalesLeadCustomerNames } from "./sales-lead-customer-draft";

/** 组件按线索编号重新挂载，表单只初始化一次；失败时保留业务员已经填写的内容。 */
export function SalesLeadCustomerDialog({ detail, errorCode, pending, onClose, onSubmit }: {
  detail: SalesLeadDetail; errorCode: string | null; pending: boolean;
  onClose: () => void; onSubmit: (input: SalesLeadCustomerInput) => Promise<void>;
}) {
  const t = useTranslations("SalesLeads");
  const [draft, setDraft] = useState(() => createSalesLeadCustomerDraft(detail.lead, {
    email: t("fields.email"), phone: t("fields.phone"), whatsapp: t("fields.whatsapp"),
    website_url: t("fields.website"),
    public_contact: t("fields.publicContact"), community_url: t("fields.community"), source: t("customer.sourcePrefix"),
  }));
  const { lead } = detail;
  const owner = lead.assignee_name ?? detail.assignments.find((item) => item.id === lead.current_assignment_id)?.assignee_name;
  const names = splitSalesLeadCustomerNames(draft.otherNames);
  const valid = Boolean(draft.uniqueName.trim() && draft.contactDetails.trim() && lead.current_assignment_id)
    && draft.uniqueName.trim().length <= 200 && names.length <= 50 && names.every((name) => name.length <= 200);
  const update = (key: keyof typeof draft, value: string) => setDraft((current) => ({ ...current, [key]: value }));
  return <FormDialog cancelLabel={t("actions.cancel")} description={t("customer.description")}
    feedback={errorCode ? { message: t(`errors.${errorCode}`), tone: errorCode === "sales_lead_save_unconfirmed" ? "info" : "error" } : null}
    onOpenChange={(open) => { if (!open) onClose(); }}
    onSubmit={() => void onSubmit({ leadId: lead.id, assignmentId: lead.current_assignment_id!,
      uniqueName: draft.uniqueName.trim(), contactDetails: draft.contactDetails.trim(), otherNames: names,
      source: draft.source.trim() || null, notes: draft.notes.trim() || null })}
    open pending={pending} submitDisabled={!valid || ["sales_lead_assignment_changed", "sales_lead_not_active", "sales_lead_convert_not_owned", "sales_lead_convert_not_allowed", "sales_lead_assignee_invalid"].includes(errorCode ?? "")}
    submitLabel={t("customer.submit")} submitTestId="submit-lead-customer" title={t("customer.title")}>
    <div className="grid min-w-0 gap-4 sm:grid-cols-2">
      <DashboardFormField label={t("customer.name")} required><Input data-testid="lead-customer-name" maxLength={200} onChange={(event) => update("uniqueName", event.target.value)} value={draft.uniqueName} /></DashboardFormField>
      <DashboardFormField label={t("customer.owner")}><Input readOnly value={owner ?? t("detail.notProvided")} /></DashboardFormField>
      <DashboardFormField className="sm:col-span-2" label={t("customer.contacts")} required><DashboardFormTextarea data-testid="lead-customer-contacts" maxLength={8000} onChange={(event) => update("contactDetails", event.target.value)} rows={5} value={draft.contactDetails} /></DashboardFormField>
      <DashboardFormField className="sm:col-span-2" hint={t("customer.otherNamesHint")} label={t("customer.otherNames")}><DashboardFormTextarea maxLength={10000} onChange={(event) => update("otherNames", event.target.value)} value={draft.otherNames} /></DashboardFormField>
      <DashboardFormField className="sm:col-span-2" label={t("customer.source")}><DashboardFormTextarea maxLength={4000} onChange={(event) => update("source", event.target.value)} value={draft.source} /></DashboardFormField>
      <DashboardFormField className="sm:col-span-2" label={t("customer.notes")}><DashboardFormTextarea data-testid="lead-customer-notes" maxLength={8000} onChange={(event) => update("notes", event.target.value)} value={draft.notes} /></DashboardFormField>
    </div>
  </FormDialog>;
}
