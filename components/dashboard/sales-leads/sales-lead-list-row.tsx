"use client";

import { useId, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type { SalesLead } from "@/lib/sales-leads-types";
import { formatLeadCountdown, formatLeadDate } from "./sales-leads-display";
import { SalesLeadPublicInfo } from "./sales-lead-public-info";
import { SalesLeadValue } from "./sales-lead-value";

export type SalesLeadPresentationProps = {
  canManage: boolean; now: number; pending: string | null;
  onClaim: (id: string) => void; onOpen: (lead: SalesLead) => void;
};

function Cell({ label, children }: { label?: string; children: ReactNode }) {
  return <td className="block min-w-0 px-3 py-2 align-top xl:table-cell xl:py-4">
    {label ? <span className="mb-1 block text-xs text-content-muted xl:sr-only">{label}</span> : null}
    {children}
  </td>;
}

// 行内展开只使用已读取的公开字段，不请求联系历史；认领和详情复用页面回调。
export function SalesLeadListRow({ lead, canManage, now, pending, onClaim, onOpen }: SalesLeadPresentationProps & { lead: SalesLead }) {
  const t = useTranslations("SalesLeads");
  const locale = useLocale();
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const contacts = [
    { label: t("fields.email"), value: lead.email, kind: "email" as const },
    { label: t("fields.phone"), value: lead.phone, kind: "phone" as const },
    { label: t("fields.whatsapp"), value: lead.whatsapp, kind: "whatsapp" as const },
    { label: t("fields.website"), value: lead.website_url, kind: "web" as const },
  ].filter(({ value }) => value?.trim());
  return <>
    <tr className="grid min-w-0 grid-cols-1 border-t border-border-subtle py-3 first:border-t-0 md:grid-cols-2 xl:table-row xl:py-0" data-testid={`sales-lead-row-${lead.id}`}>
      <Cell>
        <h3 className="break-words font-bold text-content-strong [overflow-wrap:anywhere]">{lead.name}</h3>
        <p className="mt-1 break-words text-sm text-content-muted [overflow-wrap:anywhere]">{lead.category}</p>
        <p className="mt-2 text-xs text-content-muted">{t("fields.customerProfile")}</p>
        <p className="line-clamp-2 break-words text-sm leading-6 [overflow-wrap:anywhere]" data-testid="profile-summary">{lead.customer_profile?.trim() || t("detail.notProvided")}</p>
      </Cell>
      <Cell label={t("list.location")}><p className="break-words [overflow-wrap:anywhere]">{lead.country}</p><SalesLeadValue value={lead.region_timezone} /></Cell>
      <Cell label={t("list.priorityStatus")}><div className="flex flex-wrap gap-2">
        <StatusBadge tone={lead.priority === "A" ? "danger" : lead.priority === "B" ? "warning" : "neutral"}>{t("priority", { priority: lead.priority })}</StatusBadge>
        <StatusBadge tone={lead.status === "used" ? "success" : lead.status === "claimed" ? "info" : "neutral"}>{t(`status.${lead.status}`)}</StatusBadge>
      </div></Cell>
      <Cell label={t("list.contacts")}>
        <dl className="space-y-2">{contacts.map(({ label, value, kind }) => <div className="min-w-0" key={kind}>
          <dt className="text-xs text-content-muted">{label}</dt><dd className="min-w-0">
            {/* 联系摘要限制行高；链接地址不变，展开资料中仍展示完整原文。 */}
            <div className="line-clamp-2"><SalesLeadValue kind={kind} value={value} /></div>
          </dd>
        </div>)}</dl>
        {!contacts.length ? <span>{t("detail.notProvided")}</span> : null}
      </Cell>
      <Cell label={t("list.followUp")}><dl className="space-y-2 break-words [overflow-wrap:anywhere]">
        {lead.assignee_name ? <div><dt className="text-xs text-content-muted">{t("fields.assignee")}</dt><dd>{lead.assignee_name}</dd></div> : null}
        {lead.status === "claimed" ? <div><dt className="text-xs text-content-muted">{t("fields.timeRemaining")}</dt><dd>{formatLeadCountdown(lead, now, {
          expired: t("countdown.expired"), daysHours: (days, hours) => t("countdown.daysHours", { days, hours }),
          hoursMinutes: (hours, minutes) => t("countdown.hoursMinutes", { hours, minutes }),
        })}</dd></div> : null}
        {lead.next_follow_up_at ? <div><dt className="text-xs text-content-muted">{t("fields.nextFollowUp")}</dt><dd>{formatLeadDate(lead.next_follow_up_at, locale)}</dd></div> : null}
        <div><dt className="text-xs text-content-muted">{t("fields.sourceDate")}</dt><dd>{lead.latest_source_date}</dd></div>
      </dl></Cell>
      <Cell label={t("list.actions")}><div className="flex min-w-0 flex-wrap gap-2 xl:flex-col xl:items-stretch">
        {lead.status === "hall" ? <Button data-testid={`claim-lead-${lead.id}`} disabled={pending === lead.id} onClick={() => onClaim(lead.id)} size="compact" wrap>{t(canManage ? "actions.claimForMe" : "actions.claim")}</Button> : null}
        <Button disabled={pending === lead.id} onClick={() => onOpen(lead)} size="compact" variant="outline" wrap>{t("actions.details")}</Button>
        <Button aria-controls={`${id}-public`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)} size="compact" variant="outline" wrap>{expanded ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}{t(expanded ? "view.collapse" : "view.expand")}</Button>
      </div></Cell>
    </tr>
    <tr className={expanded ? "block xl:table-row" : "hidden"}><td className="block min-w-0 p-3 xl:table-cell" colSpan={6}>
      <div className="min-w-0 space-y-6 rounded-record-card border border-border-subtle bg-surface-inset p-4" id={`${id}-public`}>
        {expanded ? <SalesLeadPublicInfo lead={lead} /> : null}
      </div>
    </td></tr>
  </>;
}
