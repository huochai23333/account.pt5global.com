import { useLocale, useTranslations } from "next-intl";

import { RecordCard } from "@/components/ui/data-display";
import type { SalesLeadDetail } from "@/lib/sales-leads-types";

import { formatLeadDate } from "./sales-leads-display";

// 只展示详情接口已授权返回的记录，不在前端另行查询或拼接其他业务员的私有信息。
export function SalesLeadHistorySection({ detail }: { detail: SalesLeadDetail }) {
  const t = useTranslations("SalesLeads");
  const locale = useLocale();
  return <>
    <section aria-labelledby="lead-history-heading">
      <h4 className="text-lg font-bold text-content-strong" id="lead-history-heading">{t("detail.contactHistory")}</h4>
      <div className="mt-3 space-y-3">
        {detail.contacts.length ? detail.contacts.map((contact) => (
          <RecordCard className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]" key={contact.id} surface="inset">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="font-semibold text-content-strong">{t(`channels.${contact.contact_channel}`)} · {t(`outcomes.${contact.contact_outcome}`)}</p>
              <time className="text-xs text-content-muted">{formatLeadDate(contact.contacted_at, locale)}</time>
            </div>
            <p className="mt-2 text-sm leading-6 text-content-muted">{contact.note}</p>
            <p className="mt-2 text-xs text-content-muted">{t("detail.recordedBy", { name: contact.author_name })}</p>
            {contact.next_follow_up_at ? <p className="mt-2 text-sm text-content-muted">{t("fields.nextFollowUp")}: {formatLeadDate(contact.next_follow_up_at, locale)}</p> : null}
          </RecordCard>
        )) : <p className="text-sm text-content-muted">{t("detail.noContacts")}</p>}
      </div>
    </section>
    <section aria-labelledby="lead-assignments-heading">
      <h4 className="text-lg font-bold text-content-strong" id="lead-assignments-heading">{t("detail.assignmentHistory")}</h4>
      <div className="mt-3 space-y-3">
        {detail.assignments.length ? detail.assignments.map((assignment) => (
          <RecordCard className="min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]" key={assignment.id} surface="inset">
            <p className="font-semibold text-content-strong">{assignment.assignee_name}</p>
            <p className="mt-1 text-sm text-content-muted">{formatLeadDate(assignment.claimed_at, locale)} — {formatLeadDate(assignment.ended_at, locale)}</p>
            {assignment.first_contact_at ? <p className="mt-2 text-sm text-content-muted">{t("fields.firstContact")}: {formatLeadDate(assignment.first_contact_at, locale)}</p> : null}
            {assignment.last_contact_at ? <p className="mt-2 text-sm text-content-muted">{t("fields.lastContact")}: {formatLeadDate(assignment.last_contact_at, locale)}</p> : null}
            {assignment.ended_reason ? <p className="mt-2 text-sm text-content-muted">{t(`endReasons.${assignment.ended_reason}`)}{assignment.end_note ? ` · ${assignment.end_note}` : ""}</p> : null}
          </RecordCard>
        )) : <p className="text-sm text-content-muted">{t("detail.noAssignments")}</p>}
      </div>
    </section>
  </>;
}
