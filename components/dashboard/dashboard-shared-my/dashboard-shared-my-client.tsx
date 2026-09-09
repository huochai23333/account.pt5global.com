"use client";

import type { CurrentUserBundle } from "@/lib/user-self-service";

import { LoadingState } from "@/components/dashboard/dashboard-shared-ui";
import {
  DashboardAccessState,
  DashboardPageShell,
} from "@/components/dashboard/dashboard-page-shell";
import { DashboardFilePicker } from "@/components/dashboard/dashboard-framework-primitives";
import { useDashboardMyCopy } from "./dashboard-shared-my-copy";
import { DashboardSharedMyDialogs } from "./dashboard-shared-my-dialogs";
import { DashboardSharedMySections } from "./dashboard-shared-my-sections";
import { useDashboardSharedMyState } from "./use-dashboard-shared-my-state";

type DashboardSharedMyClientProps = {
  emailReminderHref?: string | null;
  initialData?: CurrentUserBundle | null;
};

export function DashboardSharedMyClient({
  emailReminderHref = null,
  initialData = null,
}: DashboardSharedMyClientProps) {
  const copy = useDashboardMyCopy();
  const {
    account,
    accountSwitcher,
    assetDialog,
    bundle,
    identity,
    loading,
    page,
    passport,
    photoInputRef,
    profileDialog,
    ui,
    videoInputRef,
  } = useDashboardSharedMyState(initialData);

  if (loading) {
    return <LoadingState />;
  }

  if (!bundle) {
    return (
      <DashboardPageShell
        className="gap-6"
        feedback={{
          tone: "error",
          message: page.error ?? copy.bundleUnavailable,
        }}
      >
        <DashboardAccessState
          actionLabel={copy.retrySync}
          description={copy.bundleSyncDescription}
          kind="error"
          onAction={page.recoverCloudSync}
          title={copy.bundleSyncTitle}
        />
      </DashboardPageShell>
    );
  }

  return (
    <>
      <DashboardPageShell
        feedback={
          page.error ? { tone: "error", message: page.error } : page.notice
        }
      >
        <DashboardSharedMySections
          copy={copy}
          emailReminderHref={emailReminderHref}
          state={{
            account,
            accountSwitcher,
            assetDialog,
            page,
            profileDialog,
            ui,
          }}
        />
      </DashboardPageShell>

      <DashboardFilePicker
        accept="image/*"
        inputRef={photoInputRef}
        multiple
        onFiles={(files) => {
          if (files.length > 0) {
            void assetDialog.uploadPhotos(files);
          }
        }}
        triggerHidden
      />
      <DashboardFilePicker
        accept="video/*"
        inputRef={videoInputRef}
        multiple
        onFiles={(files) => {
          if (files.length > 0) {
            void assetDialog.uploadVideos(files);
          }
        }}
        triggerHidden
      />

      <DashboardSharedMyDialogs
        copy={copy}
        state={{ assetDialog, identity, passport, profileDialog, ui }}
      />
    </>
  );
}
