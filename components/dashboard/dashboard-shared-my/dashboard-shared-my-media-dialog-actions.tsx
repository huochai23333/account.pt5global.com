"use client";

import type { RefObject } from "react";
import { LoaderCircle, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { CurrentUserBundle } from "@/lib/user-self-service";
import type { MediaAssetKey } from "../dashboard-shared-ui";
import type { DashboardSharedMyStateCopy } from "./dashboard-shared-my-state-copy";

// 弹窗操作区只负责按钮展示，真正的上传和删除由媒体 mutation hook 执行。
export function DashboardSharedMyMediaDialogActions({
  activeDialog,
  busyKey,
  copy,
  deletePhotoAssets,
  deleteVideoAssets,
  photoAssets,
  photoInputRef,
  pendingPhotoFiles,
  pendingVideoFiles,
  retryPhotos,
  retryVideos,
  videoAssets,
  videoInputRef,
}: {
  activeDialog: MediaAssetKey | null;
  busyKey: string | null;
  copy: DashboardSharedMyStateCopy;
  deletePhotoAssets: (
    targets: CurrentUserBundle["mediaAssets"],
  ) => Promise<void>;
  deleteVideoAssets: (
    targets: CurrentUserBundle["mediaAssets"],
  ) => Promise<void>;
  photoAssets: CurrentUserBundle["mediaAssets"];
  photoInputRef: RefObject<HTMLInputElement | null>;
  pendingPhotoFiles: File[];
  pendingVideoFiles: File[];
  retryPhotos: () => Promise<void>;
  retryVideos: () => Promise<void>;
  videoAssets: CurrentUserBundle["mediaAssets"];
  videoInputRef: RefObject<HTMLInputElement | null>;
}) {
  if (activeDialog !== "photos" && activeDialog !== "videos") return null;

  const isPhotos = activeDialog === "photos";
  const assets = isPhotos ? photoAssets : videoAssets;
  const deleteBusyKey = isPhotos ? "photos-delete" : "videos-delete";
  const uploadBusyKey = isPhotos ? "photos-upload" : "videos-upload";
  const deleteLabel = isPhotos ? copy.deletePhotos : copy.deleteVideos;
  const uploadLabel = isPhotos ? copy.uploadPhotos : copy.uploadVideos;
  const inputRef = isPhotos ? photoInputRef : videoInputRef;
  const handleDelete = isPhotos ? deletePhotoAssets : deleteVideoAssets;
  const pendingFiles = isPhotos ? pendingPhotoFiles : pendingVideoFiles;
  const retry = isPhotos ? retryPhotos : retryVideos;

  return (
    <>
      {pendingFiles.length > 0 ? (
        <div className="w-full text-sm text-content-muted">
          <p>{copy.selectedUploadFiles}: {pendingFiles.map((file) => file.name).join("、")}</p>
          <Button disabled={busyKey !== null} onClick={() => void retry()} size="compact" type="button" variant="outline">
            {copy.retryUpload}
          </Button>
        </div>
      ) : null}
      <Button
        size="default"
        disabled={!assets.length || busyKey !== null}
        onClick={() => void handleDelete(assets)}
        variant="outline"
      >
        {busyKey === deleteBusyKey ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Trash2 className="size-4" />
        )}
        {deleteLabel}
      </Button>
      <Button
        variant="primary"
        size="default"
        disabled={busyKey !== null}
        onClick={() => inputRef.current?.click()}
      >
        {busyKey === uploadBusyKey ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {uploadLabel}
      </Button>
    </>
  );
}
