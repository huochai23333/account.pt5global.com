"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ImageIcon, Video } from "lucide-react";
import { useTranslations } from "next-intl";
import { Surface } from "@/components/ui/surface";
import type { PendingMediaReviewWithPreview } from "@/lib/admin-reviews";
import { DashboardDialog } from "../dashboard-dialog";
import { getDisplayEmail, getDisplayName } from "./admin-reviews-shared-ui";

// 预览仅消费签名链接。视频的播放与图片加载失败由这个区块处理。
export function MediaPreviewDialog({
  asset,
  onOpenChange,
}: {
  asset: PendingMediaReviewWithPreview | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("ReviewsUI");
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!asset || asset.kind !== "video") {
      return;
    }

    const player = videoRef.current;

    if (!player) {
      return;
    }

    player.currentTime = 0;

    void player.play().catch(() => {
      // 浏览器可能阻止自动播放，保留控件供审核员手动播放。
    });
  }, [asset]);

  return (
    <DashboardDialog
      description={
        asset
          ? `${getDisplayName(asset.name, asset.email, t("fallback.unnamedUser"))} - ${getDisplayEmail(asset.email, t("fallback.notProvided"))}`
          : undefined
      }
      onOpenChange={onOpenChange}
      open={asset !== null}
      title={asset?.original_name ?? t("media.previewTitle")}
    >
      {asset ? (
        <div className="space-y-4">
          {/* 预览沿用共享凹面样式，媒体本身贴边显示。 */}
          <Surface as="div" variant="inset" padding={null} className="overflow-hidden">
            {asset.previewUrl ? (
              asset.kind === "video" ? (
                <video
                  ref={videoRef}
                  autoPlay
                  className="max-h-[72vh] w-full bg-black object-contain"
                  controls
                  playsInline
                  preload="auto"
                  src={asset.previewUrl}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt={asset.original_name}
                  className="max-h-[72vh] w-full object-contain"
                  src={asset.previewUrl}
                />
              )
            ) : (
              <div className="flex min-h-[360px] items-center justify-center bg-[linear-gradient(135deg,var(--chart-1)_0%,var(--chart-1)_100%)]">
                <MediaPreviewFallback
                  kind={asset.kind}
                  label={asset.kind === "video" ? t("media.video") : t("media.image")}
                />
              </div>
            )}
          </Surface>

          <div className="flex flex-wrap items-center gap-3 text-sm text-content-muted">
            <span className="inline-flex items-center rounded-full bg-status-info-soft px-3 py-1 font-medium text-primary">
              {asset.kind === "video" ? t("media.videoPreview") : t("media.imagePreview")}
            </span>
            <span className="truncate">{asset.original_name}</span>
          </div>
        </div>
      ) : null}
    </DashboardDialog>
  );
}

export function MediaPreview({ asset }: { asset: PendingMediaReviewWithPreview }) {
  const t = useTranslations("ReviewsUI");
  const [previewFailed, setPreviewFailed] = useState(false);
  const kindLabel = asset.kind === "video" ? t("media.video") : t("media.image");

  if (!asset.previewUrl || previewFailed) {
    return <MediaPreviewFallback kind={asset.kind} label={kindLabel} />;
  }

  if (asset.kind === "video") {
    return (
      <div className="relative h-full w-full overflow-hidden bg-surface-inset">
        <video
          className="h-full w-full object-cover"
          muted
          onError={() => setPreviewFailed(true)}
          playsInline
          preload="metadata"
          src={asset.previewUrl}
        />
        <MediaPreviewBadge>{kindLabel}</MediaPreviewBadge>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-surface-inset">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt={asset.original_name}
        className="h-full w-full object-cover"
        loading="lazy"
        onError={() => setPreviewFailed(true)}
        src={asset.previewUrl}
      />
      <MediaPreviewBadge>{kindLabel}</MediaPreviewBadge>
    </div>
  );
}

function MediaPreviewFallback({
  kind,
  label,
}: {
  kind: PendingMediaReviewWithPreview["kind"];
  label: string;
}) {
  const t = useTranslations("ReviewsUI");
  const Icon = kind === "video" ? Video : ImageIcon;

  return (
    <div className="relative flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--chart-1)_0%,var(--chart-1)_100%)] text-primary">
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border-subtle bg-surface-overlay">
          <Icon className="size-5" />
        </div>
        <span className="text-xs font-medium text-content-muted">
          {t("media.previewUnavailable")}
        </span>
      </div>
      <MediaPreviewBadge>{label}</MediaPreviewBadge>
    </div>
  );
}

function MediaPreviewBadge({ children }: { children: ReactNode }) {
  return (
    <span className="absolute left-2.5 top-2.5 inline-flex items-center rounded-full bg-content-strong/70 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
      {children}
    </span>
  );
}
