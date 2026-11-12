"use client";

import * as FormControls from "@/components/ui/form-controls";
import dynamic from "next/dynamic";
import { LoaderCircle, Upload, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackNotice } from "../dashboard-shared-ui";
import { DashboardSharedMyPrivacyContent } from "./dashboard-shared-my-privacy-content";
import {
  DashboardSharedMyPhotoContent,
  DashboardSharedMyVideoContent,
} from "./dashboard-shared-my-media-content";
import { DashboardSharedMyMediaDialogActions } from "./dashboard-shared-my-media-dialog-actions";
import type { DashboardMyCopy } from "./dashboard-shared-my-copy";
import type { DashboardSharedMyState } from "./use-dashboard-shared-my-state";

const DashboardDialog = dynamic(
  () => import("../dashboard-dialog").then((mod) => mod.DashboardDialog),
  { ssr: false },
);
type DashboardSharedMyDialogsProps = {
  copy: DashboardMyCopy;
  state: Pick<
    DashboardSharedMyState,
    "assetDialog" | "identity" | "passport" | "profileDialog" | "ui"
  >;
};

/** 弹窗容器协调当前内容；证件、媒体展示各自独立，状态 Hook 不再生成操作区 JSX。 */
export function DashboardSharedMyDialogs({
  copy,
  state,
}: DashboardSharedMyDialogsProps) {
  const { assetDialog, profileDialog, ui } = state;
  return (
    <>
      {assetDialog.activeDialog !== null ? (
        <DashboardDialog
          actions={
            // 证件弹窗原本没有底部操作栏，必须传空值，不能传一个最终返回 null 的组件。
            assetDialog.activeDialog === "photos" ||
            assetDialog.activeDialog === "videos" ? (
              <DashboardSharedMyMediaDialogActions
                activeDialog={assetDialog.activeDialog}
                busyKey={ui.busyKey}
                copy={assetDialog.actionCopy}
                deletePhotoAssets={assetDialog.deletePhotoAssets}
                deleteVideoAssets={assetDialog.deleteVideoAssets}
                photoAssets={assetDialog.photoAssets}
                videoAssets={assetDialog.videoAssets}
                photoInputRef={assetDialog.photoInputRef}
                videoInputRef={assetDialog.videoInputRef}
                pendingPhotoFiles={assetDialog.pendingPhotoFiles}
                pendingVideoFiles={assetDialog.pendingVideoFiles}
                retryPhotos={assetDialog.retryPhotos}
                retryVideos={assetDialog.retryVideos}
              />
            ) : undefined
          }
          description={assetDialog.description}
          onOpenChange={assetDialog.close}
          open
          title={assetDialog.title}
        >
          {assetDialog.notice ? (
            <div className="mb-5">
              <FeedbackNotice tone={assetDialog.notice.tone}>
                {assetDialog.notice.message}
              </FeedbackNotice>
            </div>
          ) : null}
          {assetDialog.activeDialog === "identity" ||
          assetDialog.activeDialog === "passport" ? (
            <DashboardSharedMyPrivacyContent
              copy={copy}
              kind={assetDialog.activeDialog}
              state={state}
            />
          ) : assetDialog.activeDialog === "photos" ? (
            <DashboardSharedMyPhotoContent copy={copy} state={state} />
          ) : (
            <DashboardSharedMyVideoContent copy={copy} state={state} />
          )}
        </DashboardDialog>
      ) : null}
      {profileDialog.open ? (
        <DashboardDialog
          description={copy.editProfileDescription}
          onOpenChange={profileDialog.close}
          open
          title={copy.editProfile}
        >
          {profileDialog.notice ? (
            <div className="mb-5">
              <FeedbackNotice tone={profileDialog.notice.tone}>
                {profileDialog.notice.message}
              </FeedbackNotice>
            </div>
          ) : null}

          <div className="rounded-surface-panel border border-border-subtle bg-surface-interactive p-6 shadow-surface-interactive">
            <div className="flex items-center gap-3 text-primary">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-status-info-soft">
                <UserRound className="size-5" />
              </div>
              <div>
                <p className="font-label text-[11px] font-semibold tracking-[0.18em] text-content-muted uppercase">
                  {copy.editProfile}
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <FormControls.Field label={copy.nameLabel} required>
                <FormControls.Input
                  onChange={(event) =>
                    profileDialog.setNameDraft(event.target.value)
                  }
                  placeholder={copy.namePlaceholder}
                  value={profileDialog.nameDraft}
                />
              </FormControls.Field>

              <FormControls.Field label={copy.cityLabel} required>
                <FormControls.Input
                  onChange={(event) =>
                    profileDialog.setCityDraft(event.target.value)
                  }
                  placeholder={copy.cityPlaceholder}
                  value={profileDialog.cityDraft}
                />
              </FormControls.Field>

              <div className="flex justify-end">
                <Button
                  variant="primary"
                  size="default"
                  disabled={
                    !profileDialog.nameDraft.trim() ||
                    !profileDialog.cityDraft.trim() ||
                    ui.busyKey === "profile-save"
                  }
                  onClick={() => void profileDialog.saveProfile()}
                >
                  {ui.busyKey === "profile-save" ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  {copy.saveProfile}
                </Button>
              </div>
            </div>
          </div>
        </DashboardDialog>
      ) : null}
    </>
  );
}
