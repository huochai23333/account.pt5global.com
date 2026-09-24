"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { useLocale } from "@/components/i18n/locale-provider";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  getCurrentUserBundle,
  type CurrentUserBundle,
} from "@/lib/user-self-service";

import { type MediaAssetKey, toErrorMessage } from "../dashboard-shared-ui";
import {
  useWorkspaceRecoverCloudSync,
  useWorkspaceSyncEffect,
} from "../workspace-session-provider";
import { DashboardSharedMyMediaDialogActions } from "./dashboard-shared-my-media-dialog-actions";
import {
  type DashboardSharedMyNotice,
  type DashboardSharedMyRefreshOptions,
  refreshDashboardSharedMyBundle,
} from "./dashboard-shared-my-refresh";
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
  const router = useRouter();
  const { locale } = useLocale();
  const { copy, sharedCopy } = useDashboardSharedMyStateCopy();
  const supabase = getBrowserSupabaseClient();
  const recoverWorkspaceCloudSync = useWorkspaceRecoverCloudSync();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const hasLoadedInitialBundleRef = useRef(Boolean(initialData));

  const [bundle, setBundle] = useState<CurrentUserBundle | null>(initialData);
  const [loading, setLoading] = useState(initialData === null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [pageNotice, setPageNotice] = useState<DashboardSharedMyNotice | null>(
    null,
  );
  const [dialogNotice, setDialogNotice] =
    useState<DashboardSharedMyNotice | null>(null);
  const [activeDialog, setActiveDialog] = useState<MediaAssetKey | null>(null);
  const [identityDraft, setIdentityDraft] = useState("");
  const [passportDraft, setPassportDraft] = useState("");
  const [identityEditing, setIdentityEditing] = useState(false);
  const [passportEditing, setPassportEditing] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const recoverCloudSync = useCallback(() => {
    setPageError(null);
    setPageNotice(null);
    setLoading(true);
    recoverWorkspaceCloudSync();
  }, [recoverWorkspaceCloudSync]);

  const loadBundle = useCallback(
    async ({
      isMounted,
      showLoading,
    }: {
      isMounted: () => boolean;
      showLoading: boolean;
    }) => {
      if (!supabase) {
        return;
      }

      if (showLoading && isMounted()) {
        setLoading(true);
      }

      try {
        const nextBundle = await getCurrentUserBundle(supabase);

        if (!isMounted()) {
          return;
        }

        if (!nextBundle) {
          router.replace("/login");
          return;
        }

        setBundle(nextBundle);
        setPageError(null);
      } catch (error) {
        if (!isMounted()) {
          return;
        }

        setPageError(toErrorMessage(error, sharedCopy));
      } finally {
        if (isMounted()) {
          setLoading(false);
        }
      }
    },
    [router, sharedCopy, supabase],
  );

  useEffect(() => {
    if (
      initialData !== null ||
      !supabase ||
      hasLoadedInitialBundleRef.current
    ) {
      return;
    }

    let mounted = true;
    hasLoadedInitialBundleRef.current = true;

    void loadBundle({
      isMounted: () => mounted,
      showLoading: true,
    });

    return () => {
      mounted = false;
    };
  }, [initialData, loadBundle, supabase]);

  useWorkspaceSyncEffect(({ isMounted, syncVersion }) => {
    if (syncVersion === 0 || !supabase) {
      return;
    }

    if (!hasLoadedInitialBundleRef.current) {
      hasLoadedInitialBundleRef.current = true;
    }

    return loadBundle({
      isMounted,
      showLoading: !bundle,
    });
  });

  const refreshBundle = (options: DashboardSharedMyRefreshOptions = {}) =>
    refreshDashboardSharedMyBundle(
      {
        activeDialog,
        onRequireLogin: () => router.replace("/login"),
        setBundle,
        setBusyKey,
        setDialogNotice,
        setPageError,
        setPageNotice,
        sharedCopy,
        supabase,
      },
      options,
    );

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

  const dialogActions =
    activeDialog === "photos" || activeDialog === "videos" ? (
      <DashboardSharedMyMediaDialogActions
        activeDialog={activeDialog}
        busyKey={busyKey}
        copy={copy}
        deletePhotoAssets={mediaActions.deletePhotoAssets}
        deleteVideoAssets={mediaActions.deleteVideoAssets}
        photoAssets={photoAssets}
        photoInputRef={photoInputRef}
        pendingPhotoFiles={mediaActions.pendingPhotoFiles}
        pendingVideoFiles={mediaActions.pendingVideoFiles}
        retryPhotos={mediaActions.retryPhotos}
        retryVideos={mediaActions.retryVideos}
        videoAssets={videoAssets}
        videoInputRef={videoInputRef}
      />
    ) : undefined;

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
      actions: dialogActions,
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
