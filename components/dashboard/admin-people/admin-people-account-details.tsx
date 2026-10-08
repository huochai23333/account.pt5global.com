"use client";

import type { ReactNode } from "react";
import { DocumentEntry } from "@/components/dashboard/document-library/document-entry";

import { useTranslations } from "next-intl";

import type { AdminPersonRow } from "@/lib/admin-people";
import type { Locale } from "@/lib/locale";

import {
  formatPeopleDate,
  getPersonRelationSummary,
  getRoleLabel,
  getStatusLabel,
} from "./admin-people-display";
import type { useAdminPeopleViewModel } from "./use-admin-people-view-model";

type AdminPeopleViewModel = ReturnType<typeof useAdminPeopleViewModel>;

type AccountDetailItem = {
  label: string;
  value: ReactNode;
};

export function AdminPeopleAccountDetails({
  locale,
  person,
  roleLabels,
  statusLabels,
}: {
  locale: Locale;
  person: AdminPersonRow;
  roleLabels: AdminPeopleViewModel["roleLabels"];
  statusLabels: AdminPeopleViewModel["statusLabels"];
}) {
  const t = useTranslations("AdminPeople");
  const fallback = t("fallback.notProvided");
  const relation = getPersonRelationSummary(person, {
    noReferrer: t("fallback.noReferrer"),
    noTeam: t("fallback.noTeam"),
  });

  return (
    <div className="min-w-0 space-y-4">
      {/* 用人员编号打开默认资料夹，员工改名不改变文件归属。 */}
      <DocumentEntry userId={person.user_id} />
      <DetailSection
        items={[
          {
            label: t("details.email"),
            value: person.email ?? fallback,
          },
          {
            label: t("details.phone"),
            value: person.phone ?? fallback,
          },
          {
            label: t("details.role"),
            value: getRoleLabel(person.role, roleLabels, fallback),
          },
          {
            label: t("details.status"),
            value: getStatusLabel(person.status, statusLabels, fallback),
          },
          {
            label: t("details.city"),
            value: person.city ?? fallback,
          },
          {
            label: t("details.createdAt"),
            value: formatPeopleDate(person.created_at, locale, fallback),
          },
        ]}
        title={t("details.basicTitle")}
      />

      <DetailSection
        items={[
          {
            label: t("details.referralCode"),
            value: person.referral_code ?? fallback,
          },
          {
            label: t("details.referrer"),
            value: relation.referrer,
          },
          {
            label: t("details.team"),
            value: relation.team,
          },
          {
            label: t("details.directReferrals"),
            value: t("details.directReferralsValue", {
              count: person.direct_referral_count,
            }),
          },
          {
            label: t("details.latestChangeAt"),
            value: formatPeopleDate(person.latest_change_at, locale, fallback),
          },
        ]}
        title={t("details.businessTitle")}
      />

      <section>
        <p className="text-sm font-semibold text-content-strong">
          {t("details.noteTitle")}
        </p>
        <div className="mt-3 min-w-0 rounded-record-card border border-border-subtle bg-surface-interactive px-4 py-3 text-sm leading-6 text-content-muted">
          <p className="break-words [overflow-wrap:anywhere]">
            {person.private_note ?? t("fallback.noPrivateNote")}
          </p>
        </div>
      </section>
    </div>
  );
}

function DetailSection({
  items,
  title,
}: {
  items: AccountDetailItem[];
  title: string;
}) {
  return (
    <section className="min-w-0">
      <p className="text-sm font-semibold text-content-strong">{title}</p>
      <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <DetailItem item={item} key={item.label} />
        ))}
      </div>
    </section>
  );
}

function DetailItem({ item }: { item: AccountDetailItem }) {
  return (
    <div className="min-w-0 rounded-record-card border border-border-subtle bg-surface-interactive px-4 py-3">
      <p className="text-[11px] font-semibold tracking-[0.16em] text-content-subtle uppercase">
        {item.label}
      </p>
      <p className="mt-1 break-words text-sm leading-6 text-content-muted [overflow-wrap:anywhere]">
        {item.value}
      </p>
    </div>
  );
}
