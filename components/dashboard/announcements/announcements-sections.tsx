"use client";

import { DashboardPagedRecords } from "@/components/dashboard/dashboard-paged-records";

import { Select } from "@/components/ui/select";

import {
  Edit3,
  LoaderCircle,
  Megaphone,
  Radio,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  AnnouncementAudience,
  AnnouncementRow,
  AnnouncementStatus,
} from "@/lib/announcements";

import { DashboardSectionHeader } from "../dashboard-section-header";
import { DashboardResourceFilterSection } from "../dashboard-resource-filter-section";
import {
  DashboardFilterField,
  DashboardListSection,
} from "../dashboard-section-panel";
import { EmptyState } from "../dashboard-shared-ui";
import {
  announcementAudienceValues,
  announcementStatusValues,
  formatAnnouncementDate,
} from "./announcements-display";

type AnnouncementsHeaderSectionProps = {
  copy: {
    create: string;
    title: string;
  };
  onCreate: () => void;
};

type AnnouncementsFilterSectionProps = {
  audienceFilter: AnnouncementAudience | "all";
  copy: {
    allAudiences: string;
    allStatuses: string;
    audienceLabel: string;
    audienceOptions: Record<AnnouncementAudience, string>;
    statusLabel: string;
    statusOptions: Record<AnnouncementStatus, string>;
  };
  onAudienceFilterChange: (value: AnnouncementAudience | "all") => void;
  onReset: () => void;
  onStatusFilterChange: (value: AnnouncementStatus | "all") => void;
  statusFilter: AnnouncementStatus | "all";
};

type AnnouncementsListSectionProps = {
  paginationKey: string;
  announcements: AnnouncementRow[];
  copy: {
    audienceOptions: Record<AnnouncementAudience, string>;
    createdAt: string;
    delete: string;
    edit: string;
    emptyDescription: string;
    emptyTitle: string;
    offline: string;
    publishedAt: string;
    publish: string;
    statusOptions: Record<AnnouncementStatus, string>;
    updatedAt: string;
  };
  locale: string;
  onDelete: (announcement: AnnouncementRow) => void;
  onEdit: (announcement: AnnouncementRow) => void;
  onOffline: (announcement: AnnouncementRow) => void;
  onPublish: (announcement: AnnouncementRow) => void;
  pendingAction: {
    id: string;
    type: "delete" | "offline" | "publish";
  } | null;
};

export function AnnouncementsHeaderSection({
  copy,
  onCreate,
}: AnnouncementsHeaderSectionProps) {
  return (
    <DashboardSectionHeader
      actions={
        <Button variant="primary" size="default" onClick={onCreate}>
          <Megaphone className="size-4" />
          {copy.create}
        </Button>
      }
      presentation="work"
      title={copy.title}
    />
  );
}

export function AnnouncementsFilterSection({
  audienceFilter,
  copy,
  onAudienceFilterChange,
  onReset,
  onStatusFilterChange,
  statusFilter,
}: AnnouncementsFilterSectionProps) {
  return (
    <DashboardResourceFilterSection
      activeFilterCount={[
        audienceFilter !== "all",
        statusFilter !== "all",
      ].filter(Boolean).length}
      gridClassName="md:grid-cols-2"
      onReset={onReset}
      resetDisabled={audienceFilter === "all" && statusFilter === "all"}
    >
      <DashboardFilterField label={copy.statusLabel}>
        <Select
          onValueChange={onStatusFilterChange}
          options={[
            { label: copy.allStatuses, value: "all" },
            ...announcementStatusValues.map((status) => ({
              label: copy.statusOptions[status],
              value: status,
            })),
          ]}
          value={statusFilter}
        />
      </DashboardFilterField>

      <DashboardFilterField label={copy.audienceLabel}>
        <Select
          onValueChange={onAudienceFilterChange}
          options={[
            { label: copy.allAudiences, value: "all" },
            ...announcementAudienceValues.map((audience) => ({
              label: copy.audienceOptions[audience],
              value: audience,
            })),
          ]}
          value={audienceFilter}
        />
      </DashboardFilterField>
    </DashboardResourceFilterSection>
  );
}

export function AnnouncementsListSection({
  paginationKey,
  announcements,
  copy,
  locale,
  onDelete,
  onEdit,
  onOffline,
  onPublish,
  pendingAction,
}: AnnouncementsListSectionProps) {
  return (
    <DashboardListSection>
      <DashboardPagedRecords items={announcements}
        queryKey={paginationKey}>
        {(pageRows) => (
          <>
          {announcements.length === 0 ? (
            <EmptyState
              description={copy.emptyDescription}
              icon={<Search className="size-6" />}
              title={copy.emptyTitle}
            />
          ) : (
            <div className="space-y-4">
              {pageRows.map((announcement) => {
                const actionPending = pendingAction?.id === announcement.id;
                const deletePending =
                  actionPending && pendingAction?.type === "delete";
                const offlinePending =
                  actionPending && pendingAction?.type === "offline";
                const publishPending =
                  actionPending && pendingAction?.type === "publish";

                return (
                  <article
                    className="rounded-surface-panel border border-border-subtle bg-surface-inset p-5"
                    key={announcement.id}
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <StatusBadge
                            tone={getAnnouncementStatusTone(announcement.status)}
                          >
                            {copy.statusOptions[announcement.status]}
                          </StatusBadge>
                          <span className="inline-flex min-h-7 items-center rounded-full bg-status-info-soft px-3 py-1 text-xs font-semibold text-primary">
                            {copy.audienceOptions[announcement.audience]}
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-bold text-content-strong">
                          {announcement.title}
                        </h3>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-content-muted">
                          {announcement.content}
                        </p>
                        <dl className="mt-4 grid gap-2 text-xs text-content-muted sm:grid-cols-3">
                          <DateMeta
                            label={copy.publishedAt}
                            value={formatAnnouncementDate(
                              announcement.published_at,
                              locale,
                            )}
                          />
                          <DateMeta
                            label={copy.updatedAt}
                            value={formatAnnouncementDate(
                              announcement.updated_at,
                              locale,
                            )}
                          />
                          <DateMeta
                            label={copy.createdAt}
                            value={formatAnnouncementDate(
                              announcement.created_at,
                              locale,
                            )}
                          />
                        </dl>
                      </div>
                      <div className="flex flex-wrap gap-2 xl:justify-end">
                        <Button
                          size="compact"
                          disabled={actionPending}
                          onClick={() => onEdit(announcement)}
                          variant="outline"
                        >
                          <Edit3 className="size-4" />
                          {copy.edit}
                        </Button>
                        {announcement.status === "published" ? (
                          <Button
                            size="compact"
                            disabled={actionPending}
                            onClick={() => onOffline(announcement)}
                            variant="danger"
                          >
                            {offlinePending ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <Radio className="size-4" />
                            )}
                            {copy.offline}
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="compact"
                            disabled={actionPending}
                            onClick={() => onPublish(announcement)}
                          >
                            {publishPending ? (
                              <LoaderCircle className="size-4 animate-spin" />
                            ) : (
                              <Radio className="size-4" />
                            )}
                            {copy.publish}
                          </Button>
                        )}
                        <Button
                          size="compact"
                          disabled={actionPending}
                          onClick={() => onDelete(announcement)}
                          variant="danger"
                        >
                          {deletePending ? (
                            <LoaderCircle className="size-4 animate-spin" />
                          ) : (
                            <Trash2 className="size-4" />
                          )}
                          {copy.delete}
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          </>
        )}
      </DashboardPagedRecords>
    </DashboardListSection>
  );
}

function getAnnouncementStatusTone(status: AnnouncementStatus) {
  if (status === "published") return "success" as const;
  if (status === "draft") return "warning" as const;
  return "neutral" as const;
}

function DateMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="font-semibold text-content-muted">{label}</dt>
      <dd className="mt-1">{value || "-"}</dd>
    </div>
  );
}
