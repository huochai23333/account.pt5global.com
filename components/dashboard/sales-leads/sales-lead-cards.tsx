"use client";

import { Clock3, MapPin, UserRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { MetaGrid, MetaItem, RecordCard } from "@/components/ui/data-display";
import { StatusBadge } from "@/components/ui/status-badge";
import type { SalesLead } from "@/lib/sales-leads-types";

import { formatLeadCountdown, formatLeadDate } from "./sales-leads-display";

import { SalesLeadContactInfo } from "./sales-lead-contact-info";
import { SalesLeadValue } from "./sales-lead-value";

export function SalesLeadCards({
  canManage,
  items,
  now,
  onClaim,
  onOpen,
  pending,
}: {
  canManage: boolean;
  items: SalesLead[];
  now: number;
  onClaim: (leadId: string) => void;
  onOpen: (lead: SalesLead) => void;
  pending: string | null;
}) {
  const t = useTranslations("SalesLeads");
  const locale = useLocale();

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-2" data-testid="sales-lead-cards">
      {items.map((lead) => (
        <RecordCard className="min-w-0" key={lead.id}>
          <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <StatusBadge tone={lead.priority === "A" ? "danger" : lead.priority === "B" ? "warning" : "neutral"}>
                  {t("priority", { priority: lead.priority })}
                </StatusBadge>
                <StatusBadge tone={lead.status === "used" ? "success" : lead.status === "claimed" ? "info" : "neutral"}>
                  {t(`status.${lead.status}`)}
                </StatusBadge>
              </div>
              <h3 className="mt-3 break-words text-lg font-bold text-content-strong [overflow-wrap:anywhere]">
                {lead.name}
              </h3>
              <p className="mt-1 break-words text-sm text-content-muted [overflow-wrap:anywhere]">
                {lead.category}
              </p>
            </div>
            <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto sm:max-w-[52%] sm:justify-end">
              {lead.status === "hall" ? (
                <Button data-testid={`claim-lead-${lead.id}`} disabled={pending === lead.id} onClick={() => onClaim(lead.id)} size="compact" wrap>
                  {t(canManage ? "actions.claimForMe" : "actions.claim")}
                </Button>
              ) : null}
              <Button disabled={pending === lead.id} onClick={() => onOpen(lead)} size="compact" variant="outline" wrap>
                {t("actions.details")}
              </Button>
            </div>
          </div>

          <MetaGrid className="mt-5 grid-cols-1 md:grid-cols-2 xl:grid-cols-2">
            <MetaItem label={t("fields.country")}><MapPin className="size-4 shrink-0" />{lead.country}</MetaItem>
            <MetaItem label={t("fields.regionTimezone")}><SalesLeadValue value={lead.region_timezone} /></MetaItem>
            <MetaItem label={t("fields.contactToday")}>{t(lead.contact_today ? "detail.recommendedToday" : "detail.normalSchedule")}</MetaItem>
            <MetaItem label={t("fields.publicPricing")}><SalesLeadValue value={lead.public_pricing} /></MetaItem>
            {lead.status === "claimed" ? (
              <MetaItem label={t("fields.timeRemaining")}><Clock3 className="size-4 shrink-0" />{formatLeadCountdown(lead, now, {
                expired: t("countdown.expired"),
                daysHours: (days, hours) => t("countdown.daysHours", { days, hours }),
                hoursMinutes: (hours, minutes) => t("countdown.hoursMinutes", { hours, minutes }),
              })}</MetaItem>
            ) : null}
            {lead.assignee_name ? <MetaItem label={t("fields.assignee")}><UserRound className="size-4 shrink-0" />{lead.assignee_name}</MetaItem> : null}
            {lead.next_follow_up_at ? <MetaItem label={t("fields.nextFollowUp")}>{formatLeadDate(lead.next_follow_up_at, locale)}</MetaItem> : null}
            <MetaItem label={t("fields.sourceDate")}>{lead.latest_source_date}</MetaItem>
          </MetaGrid>
          <div className="mt-4 border-t border-border-subtle pt-4"><SalesLeadContactInfo lead={lead} /></div>
          <MetaGrid className="mt-4 grid-cols-1 md:grid-cols-1 xl:grid-cols-1">
            <MetaItem label={t("fields.customerProfile")}><SalesLeadValue value={lead.customer_profile} /></MetaItem>
            <MetaItem label={t("fields.targetCustomer")}><SalesLeadValue value={lead.target_customer} /></MetaItem>
            <MetaItem label={t("fields.recommendedApproach")}><SalesLeadValue value={lead.recommended_approach} /></MetaItem>
          </MetaGrid>
        </RecordCard>
      ))}
    </div>
  );
}
