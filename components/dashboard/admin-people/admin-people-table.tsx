"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";
import { UiMessage } from "@/components/i18n/ui-message";
import { StickyNote } from "lucide-react";
import { useTranslations } from "next-intl";
import { DashboardTableFrame } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { ResponsiveDataView } from "@/components/ui/responsive-data-view";
import { RecordCard } from "@/components/ui/data-display";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AdminPersonRow } from "@/lib/admin-people-contract";
import {
  getPersonContact,
  getPersonDisplayName,
  getRoleLabel,
} from "./admin-people-display";
import type { useAdminPeopleViewModel } from "./use-admin-people-view-model";
type AdminPeopleViewModel = ReturnType<typeof useAdminPeopleViewModel>;
export function PeopleTable({
  currentViewerId,
  onAdjustPerson,
  onEditPersonNote,
  people,
  roleLabels,
  statusLabels,
}: {
  currentViewerId: string | null;
  onAdjustPerson: (person: AdminPersonRow) => void;
  onEditPersonNote: (person: AdminPersonRow) => void;
  people: AdminPersonRow[];
  roleLabels: AdminPeopleViewModel["roleLabels"];
  statusLabels: AdminPeopleViewModel["statusLabels"];
}) {
  const t = useTranslations("AdminPeople");
  const fallback = t("fallback.notProvided");
  return (
    <ResponsiveDataView
      desktop={
        <DashboardTableFrame>
          <table className="w-full min-w-[860px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[32%]" />
              <col className="w-[20%]" />
              <col className="w-[16%]" />
              <col className="w-[20%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="bg-surface-inset text-xs font-semibold text-content-muted">
              <tr>
                <th className="px-3 py-3">{t("directory.columns.account")}</th>
                <th className="px-3 py-3">
                  {t("directory.columns.accountState")}
                </th>
                <th className="px-3 py-3">{t("directory.columns.city")}</th>
                <th className="px-3 py-3">
                  {t("directory.columns.privateNote")}
                </th>
                <th className="px-3 py-3">{t("directory.columns.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {people.map((person) => {
                const isCurrentViewer = person.user_id === currentViewerId;
                const displayName = getPersonDisplayName(
                  person,
                  t("fallback.unnamedUser"),
                );
                return (
                  <tr key={person.user_id} className="align-top">
                    <td className="px-3 py-4">
                      <DesignButton
                        aria-label={t("actions.openDetailsFor", {
                          name: displayName,
                        })}
                        className="block min-w-0 text-left"
                        onClick={() => onAdjustPerson(person)}
                        type="button"
                      >
                        <span className="block break-words font-semibold text-content-strong underline-offset-4 [overflow-wrap:anywhere] hover:text-primary hover:underline">
                          {displayName}
                        </span>
                        <span className="mt-1 block break-all text-xs text-content-muted">
                          {getPersonContact(person, fallback)}
                        </span>
                      </DesignButton>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex min-w-0 flex-col items-start gap-2">
                        <StatusBadge tone="info">
                          {getRoleLabel(person.role, roleLabels, fallback)}
                        </StatusBadge>
                        <StatusBadge tone={getPersonStatusTone(person.status)}>
                          {statusLabels[person.status]}
                        </StatusBadge>
                      </div>
                    </td>
                    <td className="px-3 py-4 text-content-muted">
                      {person.city ?? fallback}
                    </td>
                    <td className="px-3 py-4 text-content-muted">
                      <p className="line-clamp-3 break-words">
                        {person.private_note ?? t("fallback.noPrivateNote")}
                      </p>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <Button
                          variant="outline"
                          size="compact"
                          onClick={() => onEditPersonNote(person)}
                        >
                          <StickyNote className="size-4" />
                          {t("actions.note")}
                        </Button>
                        <Button
                          variant="primary"
                          size="compact"
                          disabled={isCurrentViewer}
                          onClick={() => onAdjustPerson(person)}
                        >
                          {isCurrentViewer
                            ? t("actions.currentAccount")
                            : t("actions.adjust")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </DashboardTableFrame>
      }
      mobile={
        <>
          {people.map((person) => {
            const isCurrentViewer = person.user_id === currentViewerId;
            const displayName = getPersonDisplayName(
              person,
              t("fallback.unnamedUser"),
            );
            return (
              <RecordCard key={person.user_id}>
                <div className="flex items-start justify-between gap-3">
                  <DesignButton
                    aria-label={t("actions.openDetailsFor", {
                      name: displayName,
                    })}
                    className="min-w-0 text-left"
                    onClick={() => onAdjustPerson(person)}
                    type="button"
                  >
                    <span className="block break-words font-semibold text-content-strong [overflow-wrap:anywhere]">
                      {displayName}
                    </span>
                    <span className="mt-1 block break-all text-sm text-content-muted">
                      {getPersonContact(person, fallback)}
                    </span>
                  </DesignButton>
                  <StatusBadge tone={getPersonStatusTone(person.status)}>
                    {statusLabels[person.status]}
                  </StatusBadge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge tone="info">
                    {getRoleLabel(person.role, roleLabels, fallback)}
                  </StatusBadge>
                  <StatusBadge>{person.city ?? fallback}</StatusBadge>
                </div>
                <p className="mt-3 line-clamp-3 break-words text-sm text-content-muted">
                  <UiMessage id="components_dashboard_admin_people_admin_people_table.text001" />
                  {person.private_note ?? t("fallback.noPrivateNote")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="compact"
                    onClick={() => onEditPersonNote(person)}
                  >
                    <StickyNote className="size-4" />
                    {t("actions.note")}
                  </Button>
                  <Button
                    variant="primary"
                    size="compact"
                    disabled={isCurrentViewer}
                    onClick={() => onAdjustPerson(person)}
                  >
                    {isCurrentViewer
                      ? t("actions.currentAccount")
                      : t("actions.adjust")}
                  </Button>
                </div>
              </RecordCard>
            );
          })}
        </>
      }
    />
  );
}

function getPersonStatusTone(status: string) {
  // 领域状态只决定语义色，标签布局、边框和字号全部由共享状态标签负责。
  if (status === "active") return "success" as const;
  if (status === "inactive") return "warning" as const;
  if (status === "suspended") return "danger" as const;
  return "neutral" as const;
}
