"use client";

import { InteractiveButton as DesignButton } from "@/components/ui/button";

import { ImageIcon, Play } from "lucide-react";
import { useTranslations } from "next-intl";

import type { PendingMediaReviewWithPreview } from "@/lib/admin-reviews";
import { cn } from "@/lib/utils";

import { EmptyState } from "../dashboard-shared-ui";
import {
  getDisplayEmail,
  getDisplayName,
  ReviewActionGroup,
  ReviewHeaderCell,
  ReviewValueCell,
} from "./admin-reviews-shared-ui";
import type { BusyAction } from "./types";
import { MediaPreview } from "./admin-review-media-preview";

export function MediaReviewList({
  rows,
  busyRows,
  onPreviewOpen,
  onAction,
}: {
  rows: PendingMediaReviewWithPreview[];
  busyRows: Record<string, BusyAction>;
  onPreviewOpen: (asset: PendingMediaReviewWithPreview) => void;
  onAction: (row: PendingMediaReviewWithPreview, action: BusyAction) => Promise<void>;
}) {
  const t = useTranslations("ReviewsUI");

  if (rows.length === 0) {
    return (
      <EmptyState
        description={t("media.emptyDescription")}
        icon={<ImageIcon className="size-6" />}
        title={t("media.emptyTitle")}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-surface-panel border border-border-subtle bg-surface-interactive shadow-surface-interactive">
      <div className="hidden grid-cols-[132px_minmax(0,1fr)_minmax(0,1fr)_minmax(150px,0.8fr)_220px] gap-5 border-b border-border-subtle bg-surface-inset px-6 py-4 lg:grid">
        <ReviewHeaderCell>{t("media.columns.preview")}</ReviewHeaderCell>
        <ReviewHeaderCell>{t("media.columns.name")}</ReviewHeaderCell>
        <ReviewHeaderCell>{t("media.columns.email")}</ReviewHeaderCell>
        <ReviewHeaderCell>{t("media.columns.aiReview")}</ReviewHeaderCell>
        <ReviewHeaderCell className="text-right">{t("media.columns.actions")}</ReviewHeaderCell>
      </div>

      <div className="divide-y divide-border-subtle">
        {rows.map((row) => {
          const rowKey = `media:${row.asset_id}`;
          const busyAction = busyRows[rowKey];
          const displayName = getDisplayName(row.name, row.email, t("fallback.unnamedUser"));
          const displayEmail = getDisplayEmail(row.email, t("fallback.notProvided"));

          return (
            <article
              key={row.asset_id}
              className="grid gap-4 px-4 py-5 lg:grid-cols-[132px_minmax(0,1fr)_minmax(0,1fr)_minmax(150px,0.8fr)_220px] lg:items-center lg:px-6"
            >
              <div>
                <p className="mb-2 font-label text-[11px] font-semibold tracking-[0.18em] text-content-muted uppercase lg:hidden">
                  {t("media.columns.preview")}
                </p>
                <DesignButton
                  className={cn(
                    "group relative block h-[92px] w-[124px] overflow-hidden rounded-record-card border border-border-subtle bg-surface-inset text-left shadow-surface-interactive transition-transform duration-200",
                    row.previewUrl
                      ? "cursor-zoom-in hover:-translate-y-0.5 focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none"
                      : "cursor-not-allowed opacity-80",
                  )}
                  disabled={!row.previewUrl}
                  onClick={() => onPreviewOpen(row)}
                  type="button"
                >
                  <MediaPreview asset={row} />
                  {row.previewUrl ? (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-surface-panel opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-overlay text-primary shadow-surface-interactive">
                        {row.kind === "video" ? (
                          <Play className="ml-0.5 size-4 fill-current" />
                        ) : (
                          <ImageIcon className="size-4" />
                        )}
                      </div>
                    </div>
                  ) : null}
                </DesignButton>
              </div>

              <ReviewValueCell label={t("media.columns.name")} value={displayName} />
              <ReviewValueCell label={t("media.columns.email")} value={displayEmail} />
              <AiReviewCell asset={row} />

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

function AiReviewCell({ asset }: { asset: PendingMediaReviewWithPreview }) {
  const t = useTranslations("ReviewsUI");
  const { className, label } = getAiReviewDisplay(asset, t);

  return (
    <div className="min-w-0">
      <p className="mb-1 font-label text-[11px] font-semibold tracking-[0.18em] text-content-muted uppercase lg:hidden">
        {t("media.columns.aiReview")}
      </p>
      <span
        className={cn(
          "inline-flex max-w-full rounded-full px-3 py-1 text-xs font-semibold",
          className,
        )}
        title={label}
      >
        <span className="truncate">{label}</span>
      </span>
    </div>
  );
}

function getAiReviewDisplay(
  asset: PendingMediaReviewWithPreview,
  t: ReturnType<typeof useTranslations>,
) {
  if (asset.kind !== "image") {
    return {
      label: t("media.aiReview.videoSkipped"),
      className: "bg-surface-inset text-content-muted",
    };
  }

  if (!asset.ai_review_status || asset.ai_review_status === "queued") {
    return {
      label: t("media.aiReview.queued"),
      className: "bg-status-info-soft text-primary",
    };
  }

  if (asset.ai_review_status === "processing") {
    return {
      label: t("media.aiReview.processing"),
      className: "bg-surface-inset text-content-muted",
    };
  }

  if (asset.ai_review_status === "failed") {
    return {
      label: t("media.aiReview.failed"),
      className: "bg-surface-inset text-status-danger",
    };
  }

  if (asset.ai_review_decision === "auto_pass") {
    return {
      label: t("media.aiReview.autoPass"),
      className: "bg-surface-inset text-status-success",
    };
  }

  if (asset.ai_review_reasons?.includes("not_configured")) {
    return {
      label: t("media.aiReview.notConfigured"),
      className: "bg-surface-inset text-content-muted",
    };
  }

  return {
    label: t("media.aiReview.manualReview"),
    className: "bg-surface-inset text-content-muted",
  };
}
