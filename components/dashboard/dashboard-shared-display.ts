import type { UserMediaAssetWithPreview } from "@/lib/user-self-service";

import type { DashboardSharedCopy } from "./dashboard-shared-copy";

export type ReviewStatus = "empty" | "pending" | "approved";
export type MediaAssetKey = "identity" | "passport" | "photos" | "videos";

// 一组资料可能同时有已通过和待审记录，卡片优先提示仍需要处理的待审项。
export function getMediaStatus(assets: UserMediaAssetWithPreview[]): ReviewStatus {
  if (assets.some((asset) => asset.status === "pending")) return "pending";
  if (assets.some((asset) => asset.status === "pass")) return "approved";
  return "empty";
}

export function getStatusLabel(
  key: MediaAssetKey,
  status: ReviewStatus,
  copy: DashboardSharedCopy,
) {
  if (status === "pending") return copy.mediaStatus.pending;
  if (status === "approved") {
    return key === "identity" || key === "passport"
      ? copy.mediaStatus.approvedIdentity
      : copy.mediaStatus.approvedGeneric;
  }
  if (key === "identity") return copy.mediaStatus.identityEmpty;
  if (key === "passport") return copy.mediaStatus.passportEmpty;
  if (key === "photos") return copy.mediaStatus.photosEmpty;
  return copy.mediaStatus.videosEmpty;
}

export function getReviewStatusTone(status: ReviewStatus) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  return "info" as const;
}

export function mapUserStatus(
  status: string | null | undefined,
  copy: DashboardSharedCopy,
) {
  if (status === "active") {
    return { accent: "success" as const, label: copy.userStatus.active };
  }
  if (status === "suspended") {
    return { accent: "default" as const, label: copy.userStatus.suspended };
  }
  return { accent: "default" as const, label: copy.userStatus.pending };
}
