import { InteractiveButton as DesignButton } from "@/components/ui/button";
import { FileBadge2, Trash2, Video } from "lucide-react";
import {
  LazyDashboardImagePreview,
  LazyDashboardVideoPreview,
} from "../dashboard-media-preview";
import {
  EmptyState,
  formatFileSize,
  StatusChip,
  StatusNotice,
} from "../dashboard-shared-ui";
import type { DashboardMyCopy } from "./dashboard-shared-my-copy";
import type { DashboardSharedMyState } from "./use-dashboard-shared-my-state";

type MediaContentProps = {
  copy: DashboardMyCopy;
  state: Pick<DashboardSharedMyState, "assetDialog" | "ui">;
};

/** 仅展示已准备的媒体与预览；按钮通过上层动作提交，成功仍需数据库及 Storage 凭证。 */
export function DashboardSharedMyPhotoContent({
  copy,
  state,
}: MediaContentProps) {
  const { assetDialog, ui } = state;
  return assetDialog.photoAssets.length ? (
    <div className="space-y-6">
      <StatusNotice
        description={
          assetDialog.photoStatus === "pending"
            ? copy.photoPendingDescription
            : copy.photoApprovedDescription
        }
        status={assetDialog.photoStatus}
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {assetDialog.photoAssets.map((photo, index) => (
          <article
            key={photo.id}
            className="rounded-surface-panel border border-border-subtle bg-surface-interactive p-3 shadow-surface-interactive"
          >
            <div className="aspect-[4/5] overflow-hidden rounded-record-card bg-surface-inset">
              <LazyDashboardImagePreview
                alt={photo.original_name}
                asset={photo}
                className="h-full w-full"
                errorFallback={
                  <div className="flex h-full items-center justify-center text-sm text-content-muted">
                    {copy.previewUnavailable}
                  </div>
                }
                imageClassName="h-full w-full object-cover"
                loadingFallback={
                  <div className="motion-skeleton h-full w-full bg-surface-inset" />
                }
              />
            </div>
            <div className="mt-3 space-y-3 px-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-content-strong">
                    {copy.photoItem(index + 1)}
                  </p>
                  <p className="truncate text-xs text-content-muted">
                    {photo.original_name}
                  </p>
                </div>
                <StatusChip status={photo.status} />
              </div>
              <DesignButton
                className="inline-flex h-9 items-center gap-1 rounded-full bg-surface-inset px-3 text-xs font-medium text-content-muted"
                disabled={ui.busyKey !== null}
                onClick={() => void assetDialog.deletePhotoAssets([photo])}
                type="button"
              >
                <Trash2 className="size-3.5" />
                {copy.delete}
              </DesignButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  ) : (
    <EmptyState
      description={copy.photoEmptyDescription}
      icon={<FileBadge2 className="size-6" />}
      title={copy.photoEmptyTitle}
    />
  );
}

export function DashboardSharedMyVideoContent({
  copy,
  state,
}: MediaContentProps) {
  const { assetDialog, ui } = state;
  return assetDialog.videoAssets.length ? (
    <div className="space-y-6">
      <StatusNotice
        description={
          assetDialog.videoStatus === "pending"
            ? copy.videoPendingDescription
            : copy.videoApprovedDescription
        }
        status={assetDialog.videoStatus}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {assetDialog.videoAssets.map((video) => (
          <article
            key={video.id}
            className="rounded-surface-panel border border-border-subtle bg-surface-interactive p-3 shadow-surface-interactive"
          >
            <div className="overflow-hidden rounded-record-card bg-surface-inset">
              <LazyDashboardVideoPreview
                asset={video}
                className="aspect-video w-full"
                errorFallback={
                  <div className="flex aspect-video items-center justify-center text-sm text-white/72">
                    {copy.previewUnavailable}
                  </div>
                }
                loadingFallback={
                  <div className="motion-skeleton h-full w-full bg-surface-on-media" />
                }
                preload="metadata"
                videoClassName="aspect-video w-full bg-surface-inset object-cover"
              />
            </div>
            <div className="mt-3 space-y-3 px-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-content-strong">
                    {video.original_name}
                  </p>
                  <p className="truncate text-xs text-content-muted">
                    {formatFileSize(video.file_size_bytes)}
                  </p>
                </div>
                <StatusChip status={video.status} />
              </div>
              <DesignButton
                className="inline-flex h-9 items-center gap-1 rounded-full bg-surface-inset px-3 text-xs font-medium text-content-muted"
                disabled={ui.busyKey !== null}
                onClick={() => void assetDialog.deleteVideoAssets([video])}
                type="button"
              >
                <Trash2 className="size-3.5" />
                {copy.delete}
              </DesignButton>
            </div>
          </article>
        ))}
      </div>
    </div>
  ) : (
    <EmptyState
      description={copy.videoEmptyDescription}
      icon={<Video className="size-6" />}
      title={copy.videoEmptyTitle}
    />
  );
}
