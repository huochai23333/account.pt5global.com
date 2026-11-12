"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import { UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardTableFrame } from "@/components/dashboard/dashboard-section-panel";
import { EmptyState } from "@/components/dashboard/dashboard-shared-ui";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { StatusBadge } from "@/components/ui/status-badge";
import { RecordCard } from "@/components/ui/data-display";
import type { AdminPersonRow } from "@/lib/admin-people-contract";
import type { Locale } from "@/lib/locale";

import {
  formatTourismPeopleDate,
  getTourismPersonContact,
  getTourismPersonName,
  type TourismPeopleTab,
} from "./tourism-people-display";

type TourismPeopleTableProps = {
  locale: Locale;
  onSelect: (person: AdminPersonRow) => void;
  people: AdminPersonRow[];
  tab: TourismPeopleTab;
};

export function TourismPeopleTable({
  locale,
  onSelect,
  people,
  tab,
}: TourismPeopleTableProps) {
  const t = useTranslations("TourismPeople.table");
  const subjectLabel = t(`subjects.${tab}`);
  const unnamedFallback = t("fallbacks.unnamed");
  const contactFallback = t("fallbacks.noContact");
  const pendingFallback = t("fallbacks.pending");
  const noReferrerFallback = t("fallbacks.noReferrer");

  if (people.length === 0) {
    return (
      <EmptyState
        description={t("emptyDescription", { subject: subjectLabel })}
        icon={<UsersRound className="size-5" />}
        title={t("emptyTitle", { subject: subjectLabel })}
      />
    );
  }

  return (
    <ResponsiveDataView
      desktop={
        <DashboardTableFrame>
          <table className="w-full min-w-[860px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[28%]" />
              <col className="w-[18%]" />
              <col className="w-[22%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="bg-surface-inset text-xs font-semibold text-content-muted">
              <tr>
                <th className="px-3 py-3">{subjectLabel}</th>
                <th className="px-3 py-3">{t("columns.status")}</th>
                <th className="px-3 py-3">{t("columns.referral")}</th>
                <th className="px-3 py-3">{t("columns.city")}</th>
                <th className="px-3 py-3">{t("columns.createdAt")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {people.map((person) => (
                <tr
                  className="cursor-pointer align-top transition-colors hover:bg-surface-inset"
                  key={person.user_id}
                  onClick={() => onSelect(person)}
                >
                  <td className="px-3 py-4">
                    <p className="break-words font-semibold text-content-strong [overflow-wrap:anywhere]">
                      {getTourismPersonName(person, unnamedFallback)}
                    </p>
                    <p className="mt-1 break-all text-xs text-content-muted">
                      {getTourismPersonContact(person, contactFallback)}
                    </p>
                    <RoleChip>{t(`roles.${tab}`)}</RoleChip>
                  </td>
                  <td className="px-3 py-4">
                    <StatusBadge tone={getPersonStatusTone(person.status)}>
                      {t(`statuses.${person.status}`)}
                    </StatusBadge>
                  </td>
                  <td className="px-3 py-4 text-content-muted">
                    <p>
                      {t("referralCode", {
                        value: person.referral_code ?? pendingFallback,
                      })}
                    </p>
                    <p className="mt-1 text-xs text-content-muted">
                      {t("referrer", {
                        value:
                          person.referrer_name ??
                          person.referrer_email ??
                          noReferrerFallback,
                      })}
                    </p>
                    <p className="mt-1 text-xs text-content-muted">
                      {t("directReferrals", {
                        count: person.direct_referral_count,
                      })}
                    </p>
                  </td>
                  <td className="px-3 py-4 text-content-muted">
                    {person.city ?? pendingFallback}
                  </td>
                  <td className="px-3 py-4 text-content-muted">
                    {formatTourismPeopleDate(
                      person.created_at,
                      locale,
                      pendingFallback,
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DashboardTableFrame>
      }
      mobile={
        <>
          {people.map((person) => (
            <RecordCard key={person.user_id}>
              <DesignButton
                className="w-full text-left"
                onClick={() => onSelect(person)}
                type="button"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-content-strong">
                      {getTourismPersonName(person, unnamedFallback)}
                    </p>
                    <p className="mt-1 break-all text-sm text-content-muted">
                      {getTourismPersonContact(person, contactFallback)}
                    </p>
                  </div>
                  <StatusBadge tone={getPersonStatusTone(person.status)}>
                    {t(`statuses.${person.status}`)}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-sm text-content-muted">
                  {t("referralCode", {
                    value: person.referral_code ?? pendingFallback,
                  })}
                </p>
                <p className="mt-1 text-sm text-content-muted">
                  {t("referrer", {
                    value:
                      person.referrer_name ??
                      person.referrer_email ??
                      noReferrerFallback,
                  })}
                </p>
              </DesignButton>
            </RecordCard>
          ))}
        </>
      }
    />
  );
}

function RoleChip({ children }: { children: string }) {
  return (
    <StatusBadge className="mt-2" tone="info">
      {children}
    </StatusBadge>
  );
}

function getPersonStatusTone(status: AdminPersonRow["status"]) {
  // 人员页面仅映射状态语义，视觉细节统一由 StatusBadge 管理。
  if (status === "active") return "success" as const;
  if (status === "inactive") return "warning" as const;
  return "danger" as const;
}
