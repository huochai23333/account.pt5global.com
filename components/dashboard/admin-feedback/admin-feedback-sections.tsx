"use client";

import { Select } from "@/components/ui/select";

import { Filter, LoaderCircle, ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  DashboardFilterField,
  DashboardListSection,
  DashboardSearchInput,
  DashboardTableFrame,
} from "@/components/dashboard/dashboard-section-panel";
import { DashboardResourceFilterSection } from "@/components/dashboard/dashboard-resource-filter-section";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import { EmptyState } from "@/components/dashboard/dashboard-shared-ui";
import type { Locale } from "@/lib/locale";
import type {
  AdminWorkspaceFeedbackItem,
  WorkspaceFeedbackStatus,
} from "@/lib/workspace-feedback";
import { cn } from "@/lib/utils";

import {
  formatFeedbackDate,
  getFeedbackRoleLabel,
  getFeedbackSubmitterContact,
  getFeedbackSubmitterName,
} from "./admin-feedback-display";
import type { useAdminFeedbackViewModel } from "./use-admin-feedback-view-model";

type AdminFeedbackViewModel = ReturnType<typeof useAdminFeedbackViewModel>;

export function AdminFeedbackHeaderSection() {
  const t = useTranslations("WorkspaceFeedback");

  return (
    <DashboardSectionHeader
      presentation="work"
      title={t("header.title")}
    />
  );
}

export function AdminFeedbackNoPermissionSection() {
  const t = useTranslations("WorkspaceFeedback");

  return (
    <DashboardListSection>
      <EmptyState
        description={t("states.noPermissionDescription")}
        icon={<ShieldAlert className="size-5" />}
        title={t("states.noPermissionTitle")}
      />
    </DashboardListSection>
  );
}

export function AdminFeedbackFilterSection({
  onSearchTextChange,
  onReset,
  onStatusFilterChange,
  onTypeFilterChange,
  searchText,
  statusFilter,
  statusLabels,
  statusOptions,
  typeFilter,
  typeLabels,
  typeOptions,
}: {
  onSearchTextChange: (value: string) => void;
  onReset: () => void;
  onStatusFilterChange: (value: string) => void;
  onTypeFilterChange: (value: string) => void;
  searchText: string;
  statusFilter: string;
  statusLabels: AdminFeedbackViewModel["statusLabels"];
  statusOptions: AdminFeedbackViewModel["statusOptions"];
  typeFilter: string;
  typeLabels: AdminFeedbackViewModel["typeLabels"];
  typeOptions: AdminFeedbackViewModel["typeOptions"];
}) {
  const t = useTranslations("WorkspaceFeedback");

  return (
    <DashboardResourceFilterSection
      activeFilterCount={[
        Boolean(searchText),
        statusFilter !== "all",
        typeFilter !== "all",
      ].filter(Boolean).length}
      gridClassName="sm:grid-cols-2"
      onReset={onReset}
      primary={
        <DashboardFilterField label={t("filters.search")}>
          <DashboardSearchInput
            onChange={onSearchTextChange}
            placeholder={t("filters.searchPlaceholder")}
            value={searchText}
          />
        </DashboardFilterField>
      }
      resetDisabled={
        !searchText && statusFilter === "all" && typeFilter === "all"
      }
    >
      <DashboardFilterField label={t("filters.type")}>
        <Select
          onValueChange={onTypeFilterChange}
          options={[
            { label: t("filters.allTypes"), value: "all" },
            ...typeOptions.map((feedbackType) => ({
              label: typeLabels[feedbackType],
              value: feedbackType,
            })),
          ]}
          value={typeFilter}
        />
      </DashboardFilterField>

      <DashboardFilterField label={t("filters.status")}>
        <Select
          onValueChange={onStatusFilterChange}
          options={[
            { label: t("filters.allStatuses"), value: "all" },
            ...statusOptions.map((status) => ({
              label: statusLabels[status],
              value: status,
            })),
          ]}
          value={statusFilter}
        />
      </DashboardFilterField>
    </DashboardResourceFilterSection>
  );
}

export function AdminFeedbackListSection({
  feedbackItems,
  locale,
  onStatusChange,
  pendingStatusId,
  roleLabels,
  statusLabels,
  statusOptions,
  typeLabels,
}: {
  feedbackItems: AdminWorkspaceFeedbackItem[];
  locale: Locale;
  onStatusChange: (feedbackId: string, status: WorkspaceFeedbackStatus) => void;
  pendingStatusId: string | null;
  roleLabels: AdminFeedbackViewModel["roleLabels"];
  statusLabels: AdminFeedbackViewModel["statusLabels"];
  statusOptions: AdminFeedbackViewModel["statusOptions"];
  typeLabels: AdminFeedbackViewModel["typeLabels"];
}) {
  const t = useTranslations("WorkspaceFeedback");

  return (
    <DashboardListSection ariaLabel={t("list.title")}>
      {feedbackItems.length === 0 ? (
        <EmptyState
          description={t("list.emptyDescription")}
          icon={<Filter className="size-5" />}
          title={t("list.emptyTitle")}
        />
      ) : (
        <DashboardTableFrame>
          <table className="min-w-[1060px] w-full text-left text-sm">
            <thead className="bg-surface-inset text-xs font-semibold text-content-muted">
              <tr>
                <th className="px-4 py-3">{t("list.feedback")}</th>
                <th className="px-4 py-3">{t("list.submitter")}</th>
                <th className="px-4 py-3">{t("list.type")}</th>
                <th className="px-4 py-3">{t("list.source")}</th>
                <th className="px-4 py-3">{t("list.createdAt")}</th>
                <th className="px-4 py-3">{t("list.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {feedbackItems.map((feedback) => (
                <FeedbackTableRow
                  feedback={feedback}
                  key={feedback.id}
                  locale={locale}
                  onStatusChange={onStatusChange}
                  pending={pendingStatusId !== null}
                  roleLabels={roleLabels}
                  statusLabels={statusLabels}
                  statusOptions={statusOptions}
                  typeLabels={typeLabels}
                />
              ))}
            </tbody>
          </table>
        </DashboardTableFrame>
      )}
    </DashboardListSection>
  );
}

function FeedbackTableRow({
  feedback,
  locale,
  onStatusChange,
  pending,
  roleLabels,
  statusLabels,
  statusOptions,
  typeLabels,
}: {
  feedback: AdminWorkspaceFeedbackItem;
  locale: Locale;
  onStatusChange: (feedbackId: string, status: WorkspaceFeedbackStatus) => void;
  pending: boolean;
  roleLabels: AdminFeedbackViewModel["roleLabels"];
  statusLabels: AdminFeedbackViewModel["statusLabels"];
  statusOptions: AdminFeedbackViewModel["statusOptions"];
  typeLabels: AdminFeedbackViewModel["typeLabels"];
}) {
  const t = useTranslations("WorkspaceFeedback");
  const fallback = t("fallback.notProvided");

  return (
    <tr className="align-top text-content-muted">
      <td className="max-w-[360px] px-4 py-4">
        <p className="font-semibold text-content-strong">{feedback.title}</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-content-muted">
          {feedback.content}
        </p>
      </td>
      <td className="px-4 py-4">
        <p className="font-semibold text-content-strong">
          {getFeedbackSubmitterName(feedback, fallback)}
        </p>
        <p className="mt-1 text-xs text-content-muted">
          {getFeedbackSubmitterContact(feedback, fallback)}
        </p>
        <p className="mt-2 text-xs font-medium text-content-muted">
          {getFeedbackRoleLabel(feedback.submitted_role, roleLabels, fallback)}
        </p>
      </td>
      <td className="px-4 py-4">
        <span className="inline-flex rounded-full bg-status-info-soft px-3 py-1 text-xs font-semibold text-primary">
          {typeLabels[feedback.feedback_type]}
        </span>
      </td>
      <td className="max-w-[190px] break-all px-4 py-4 text-xs leading-6 text-content-muted">
        {feedback.source_path}
      </td>
      <td className="px-4 py-4 text-xs leading-6 text-content-muted">
        {formatFeedbackDate(feedback.created_at, locale, fallback)}
      </td>
      <td className="px-4 py-4">
        <div aria-busy={pending || undefined} className="grid gap-2">
          <span
            className={cn(
              "inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold",
              getStatusPillClassName(feedback.status),
            )}
          >
            {statusLabels[feedback.status]}
            {pending ? <LoaderCircle aria-hidden="true" className="ml-2 size-3.5 animate-spin motion-reduce:animate-none" /> : null}
          </span>
          <Select
            aria-label={t("list.statusAction")}
            className="min-w-[132px]"
            controlSize="compact"
            disabled={pending}
            onValueChange={(value) => onStatusChange(feedback.id, value)}
            options={statusOptions.map((status) => ({
              label: statusLabels[status],
              value: status,
            }))}
            value={feedback.status}
          />
        </div>
      </td>
    </tr>
  );
}

function getStatusPillClassName(status: WorkspaceFeedbackStatus) {
  switch (status) {
    case "declined":
      return "bg-surface-inset text-content-muted";
    case "in_progress":
      return "bg-surface-inset text-primary";
    case "new":
      return "bg-surface-inset text-content-muted";
    case "resolved":
      return "bg-surface-inset text-content-muted";
  }
}
