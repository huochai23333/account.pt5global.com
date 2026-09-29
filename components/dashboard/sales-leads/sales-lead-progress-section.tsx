import { useLocale, useTranslations } from "next-intl";

import { MetaGrid, MetaItem } from "@/components/ui/data-display";
import type { SalesLeadDetail } from "@/lib/sales-leads-types";

import { SalesLeadValue } from "./sales-lead-value";
import { formatLeadDate } from "./sales-leads-display";

export function SalesLeadProgressSection({ detail }: { detail: SalesLeadDetail }) {
  const t = useTranslations("SalesLeads");
  const locale = useLocale();
  const { lead } = detail;
  // 详情接口没有额外拼接负责人姓名，直接从当前认领周期中读取，不额外请求用户资料。
  const owner = detail.assignments.find((assignment) => assignment.id === lead.current_assignment_id);
  return <section aria-labelledby="lead-progress-heading">
    <h4 className="mb-3 text-lg font-bold text-content-strong" id="lead-progress-heading">{t("detail.progress")}</h4>
    <MetaGrid className="grid-cols-1 md:grid-cols-2 xl:grid-cols-2">
      <MetaItem label={t("fields.status")}>{t(`status.${lead.status}`)}</MetaItem>
      {lead.status !== "hall" ? <MetaItem label={t("fields.assignee")}><SalesLeadValue value={owner?.assignee_name} /></MetaItem> : null}
      {lead.claimed_at ? <MetaItem label={t("fields.claimedAt")}>{formatLeadDate(lead.claimed_at, locale)}</MetaItem> : null}
      {lead.first_contact_at ? <MetaItem label={t("fields.firstContact")}>{formatLeadDate(lead.first_contact_at, locale)}</MetaItem> : null}
      {lead.last_contact_at ? <MetaItem label={t("fields.lastContact")}>{formatLeadDate(lead.last_contact_at, locale)}</MetaItem> : null}
      {lead.next_follow_up_at ? <MetaItem label={t("fields.nextFollowUp")}>{formatLeadDate(lead.next_follow_up_at, locale)}</MetaItem> : null}
      {lead.status === "claimed" ? <>
        <MetaItem label={t("fields.expiresAt")}>{formatLeadDate(lead.expires_at, locale)}</MetaItem>
      </> : null}
      {lead.converted_at ? <MetaItem label={t("fields.convertedAt")}>{formatLeadDate(lead.converted_at, locale)}</MetaItem> : null}
      {lead.customer_id ? <MetaItem className="md:col-span-2" label={t("fields.customerId")}><SalesLeadValue value={lead.customer_id} /></MetaItem> : null}
    </MetaGrid>
  </section>;
}
