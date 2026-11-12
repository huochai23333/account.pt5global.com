"use client";

import { FileBadge2 } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PendingPrivacyReviewRow } from "@/lib/admin-reviews";

import { EmptyState, normalizeOptionalString } from "../dashboard-shared-ui";
import {
  getDisplayEmail,
  getDisplayName,
  ReviewActionGroup,
  ReviewHeaderCell,
  ReviewValueCell,
} from "./admin-reviews-shared-ui";
import type { BusyAction } from "./types";

export function PrivacyReviewList({
  rows,
  busyRows,
  onAction,
}: {
  rows: PendingPrivacyReviewRow[];
  busyRows: Record<string, BusyAction>;
  onAction: (row: PendingPrivacyReviewRow, action: BusyAction) => Promise<void>;
}) {
  const t = useTranslations("ReviewsUI");

  if (rows.length === 0) {
    return (
      <EmptyState
        description={t("privacy.emptyDescription")}
        icon={<FileBadge2 className="size-6" />}
        title={t("privacy.emptyTitle")}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-surface-panel border border-border-subtle bg-surface-interactive shadow-surface-interactive">
      <div className="hidden grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_220px] gap-5 border-b border-border-subtle bg-surface-inset px-6 py-4 lg:grid">
        <ReviewHeaderCell>{t("privacy.columns.name")}</ReviewHeaderCell>
        <ReviewHeaderCell>{t("privacy.columns.email")}</ReviewHeaderCell>
        <ReviewHeaderCell>{t("privacy.columns.idCard")}</ReviewHeaderCell>
        <ReviewHeaderCell>{t("privacy.columns.passport")}</ReviewHeaderCell>
        <ReviewHeaderCell className="text-right">
          {t("privacy.columns.actions")}
        </ReviewHeaderCell>
      </div>

      <div className="divide-y divide-border-subtle">
        {rows.map((row) => {
          const rowKey = `privacy:${row.request_id}`;
          const busyAction = busyRows[rowKey];
          const displayName = getDisplayName(
            row.name,
            row.email,
            t("fallback.unnamedUser"),
          );
          const displayEmail = getDisplayEmail(
            row.email,
            t("fallback.notProvided"),
          );

          return (
            <article
              key={row.request_id}
              className="grid gap-4 px-4 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_220px] lg:items-center lg:px-6"
            >
              <ReviewValueCell
                label={t("privacy.columns.name")}
                value={displayName}
              />
              <ReviewValueCell
                label={t("privacy.columns.email")}
                value={displayEmail}
              />
              <ReviewValueCell
                label={t("privacy.columns.idCard")}
                mono
                value={normalizeOptionalString(row.id_card_requests) ?? "-"}
              />
              <ReviewValueCell
                label={t("privacy.columns.passport")}
                mono
                value={normalizeOptionalString(row.passport_requests) ?? "-"}
              />

              <div className="lg:justify-self-end">
                <ReviewActionGroup
                  busyAction={busyAction}
                  onApprove={() => void onAction(row, "approve")}
                  onReject={() => void onAction(row, "reject")}
                />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
