"use client";

import { useRef, useState } from "react";

import { useLocale } from "@/components/i18n/locale-provider";

import { type CurrentUserBundle } from "@/lib/user-self-service";

import { type MediaAssetKey } from "../dashboard-shared-ui";

import { useDashboardMyBundle } from "./use-dashboard-my-bundle";
import { type DashboardSharedMyNotice } from "./dashboard-shared-my-refresh";
import { useDashboardSharedMyStateCopy } from "./dashboard-shared-my-state-copy";
import {
  createDashboardSharedMyViewModel,
  getDashboardSharedMyDialogCopy,
} from "./dashboard-shared-my-view-model";
import { useDashboardAccountSwitcher } from "./use-dashboard-account-switcher";
import { useDashboardPasswordReset } from "./use-dashboard-password-reset";
import { useDashboardProfileDialog } from "./use-dashboard-profile-dialog";
import { useDashboardSharedMyMediaActions } from "./use-dashboard-shared-my-media-actions";
import { useDashboardSharedMyPrivacyActions } from "./use-dashboard-shared-my-privacy-actions";
import { useDashboardInviteCode } from "./use-dashboard-invite-code";

export function useDashboardSharedMyState(
  initialData: CurrentUserBundle | null = null,
) {
  const { locale } = useLocale();
  const { copy, sharedCopy } = useDashboardSharedMyStateCopy();

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [dialogNotice, setDialogNotice] =
    useState<DashboardSharedMyNotice | null>(null);
  const [activeDialog, setActiveDialog] = useState<MediaAssetKey | null>(null);
  const [identityDraft, setIdentityDraft] = useState("");
  const [passportDraft, setPassportDraft] = useState("");
  const [identityEditing, setIdentityEditing] = useState(false);
  const [passportEditing, setPassportEditing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // 总状态层只组合领域动作与弹窗意图，资料读取生命周期位于专用 Hook。
  const {
    bundle,
    loading,
    pageError,
    pageNotice,
    recoverCloudSync,
    refreshBundle,
    setPageNotice,
    supabase,
  } = useDashboardMyBundle({
    initialData,
    activeDialog,
    setBusyKey,
    setDialogNotice,
    sharedCopy,
  });

  const {
    approvedIdentityValue,
    approvedPassportValue,
    assets,
    authUser,
    certified,
    displayCity,
    displayName,
    identityStatus,
    identityValue,
    membershipLabel,
    passportStatus,
    passportValue,
    photoAssets,
    photoStatus,
    profile,
    profileStats,
    referralCode,
    role,
    verificationStatus,
    videoAssets,
    videoStatus,
  } = createDashboardSharedMyViewModel({
    bundle,
    copy,
    locale,
    sharedCopy,
  });

  const accountSwitcher = useDashboardAccountSwitcher({
    authUser,
    displayName,
    role,
    setBusyKey,
    setPageNotice,
    supabase,
  });

  const { passwordResetCooldownRemaining, sendPasswordReset } =
    useDashboardPasswordReset({
      authUser,
      copy,
      setBusyKey,
      setPageNotice,
      sharedCopy,
      supabase,
    });

  const openDialog = (key: MediaAssetKey) => {
    setDialogNotice(null);
    setActiveDialog(key);

    if (key === "identity") {
      setIdentityEditing(identityStatus === "empty");
      setIdentityDraft(
        identityStatus === "pending" ? identityValue : approvedIdentityValue,
      );
    }

    if (key === "passport") {
      setPassportEditing(passportStatus === "empty");
      setPassportDraft(
        passportStatus === "pending" ? passportValue : approvedPassportValue,
      );
    }
  };

  const closeDialog = (open: boolean) => {
    if (open) {
      return;
    }

    setActiveDialog(null);
    setDialogNotice(null);
    setIdentityEditing(false);
    setPassportEditing(false);
  };

  const copyInviteCode = useDashboardInviteCode({
    copy,
    profile,
    setPageNotice,
  });

  const profileDialog = useDashboardProfileDialog({
    authUser,
    copy,
    profile,
    refreshBundle,
    role: bundle?.role ?? null,
    setBusyKey,
    setPageNotice,
    sharedCopy,
    supabase,
  });

  const privacyActions = useDashboardSharedMyPrivacyActions({
    authUser,
    copy,
    identityDraft,
    passportDraft,
    refreshBundle,
    setBusyKey,
    setDialogNotice,
    setIdentityEditing,
    setPassportEditing,
    sharedCopy,
    supabase,
  });

  const mediaActions = useDashboardSharedMyMediaActions({
    authUser,
    copy,
    refreshBundle,
    setBusyKey,
    setDialogNotice,
    sharedCopy,
    supabase,
  });

  const dialogCopy = getDashboardSharedMyDialogCopy(activeDialog, copy);

  return {
    bundle,
    loading,
    photoInputRef,
    videoInputRef,
    supabase,
    ui: {
      busyKey,
    },
    page: {
      error: pageError,
      notice: pageNotice,
      recoverCloudSync,
      refreshBundle,
    },
    account: {
      certified,
      copyInviteCode,
      displayCity,
      displayName,
      membershipLabel,
      profileStats,
      referralCode,
      role,
      passwordResetCooldownRemaining,
      sendPasswordReset,
      verificationStatus,
    },
    accountSwitcher,
    profileDialog,
    assetDialog: {
      photoInputRef,
      videoInputRef,
      pendingPhotoFiles: mediaActions.pendingPhotoFiles,
      pendingVideoFiles: mediaActions.pendingVideoFiles,
      retryPhotos: mediaActions.retryPhotos,
      retryVideos: mediaActions.retryVideos,
      actionCopy: copy,
      activeDialog,
      assets,
      close: closeDialog,
      deletePhotoAssets: mediaActions.deletePhotoAssets,
      deleteVideoAssets: mediaActions.deleteVideoAssets,
      description: dialogCopy.description,
      notice: dialogNotice,
      openDialog,
      photoAssets,
      photoStatus,
      title: dialogCopy.title,
      uploadPhotos: mediaActions.uploadPhotos,
      uploadVideos: mediaActions.uploadVideos,
      videoAssets,
      videoStatus,
    },
    identity: {
      draft: identityDraft,
      editing: identityEditing,
      setDraft: setIdentityDraft,
      setEditing: setIdentityEditing,
      status: identityStatus,
      submit: privacyActions.submitIdentity,
      value: identityValue,
    },
    passport: {
      draft: passportDraft,
      editing: passportEditing,
      setDraft: setPassportDraft,
      setEditing: setPassportEditing,
      status: passportStatus,
      submit: privacyActions.submitPassport,
      value: passportValue,
    },
  };
}

export type DashboardSharedMyState = ReturnType<
  typeof useDashboardSharedMyState
>;
