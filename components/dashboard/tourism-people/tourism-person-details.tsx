"use client";

import { useTranslations } from "next-intl";

import type { AdminPersonRow } from "@/lib/admin-people-contract";
import type { Locale } from "@/lib/locale";

import {
  formatTourismPeopleDate,
  getTourismPersonContact,
} from "./tourism-people-display";

/** 详情字段单独渲染，人员目录与客户目录可以复用同一套展示。 */
export function TourismPersonDetails({
  locale,
  person,
}: {
  locale: Locale;
  person: AdminPersonRow;
}) {
  const t = useTranslations("TourismPeople.people");
  const pendingFallback = t("fallbacks.pending");
  const rows = [
    {
      label: t("details.contact"),
      value: getTourismPersonContact(person, t("fallbacks.noContact")),
    },
    { label: t("details.status"), value: t(`statuses.${person.status}`) },
    { label: t("details.city"), value: person.city ?? pendingFallback },
    {
      label: t("details.referralCode"),
      value: person.referral_code ?? pendingFallback,
    },
    {
      label: t("details.referrer"),
      value:
        person.referrer_name ??
        person.referrer_email ??
        t("fallbacks.noReferrer"),
    },
    {
      label: t("details.team"),
      value: person.team_name ?? t("fallbacks.noTeam"),
    },
    {
      label: t("details.directReferrals"),
      value: t("details.directReferralsValue", {
        count: person.direct_referral_count,
      }),
    },
    {
      label: t("details.createdAt"),
      value: formatTourismPeopleDate(
        person.created_at,
        locale,
        pendingFallback,
      ),
    },
    {
      label: t("details.latestChange"),
      value: formatTourismPeopleDate(
        person.latest_change_at,
        locale,
        pendingFallback,
      ),
    },
  ];

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((row) => (
        <div
          className="min-w-0 rounded-record-card border border-border-subtle bg-surface-interactive px-4 py-3"
          key={row.label}
        >
          <p className="text-[11px] font-semibold tracking-[0.16em] text-content-subtle uppercase">
            {row.label}
          </p>
          <p className="mt-1 break-words text-sm leading-6 text-content-muted [overflow-wrap:anywhere]">
            {row.value}
          </p>
        </div>
      ))}
    </div>
  );
}
