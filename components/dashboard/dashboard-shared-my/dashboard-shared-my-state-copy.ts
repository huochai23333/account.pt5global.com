"use client";

import { useTranslations } from "next-intl";

import { createDashboardSharedCopy } from "../dashboard-shared-ui";

export function useDashboardSharedMyStateCopy() {
  const t = useTranslations("DashboardMyState");
  const sharedT = useTranslations("DashboardShared");

  return {
    copy: {
      unnamedUser: t("unnamedUser"),
      pendingCity: t("pendingCity"),
      pendingValue: t("pendingValue"),
      pendingReferralCode: t("pendingReferralCode"),
      standardMembership: t("standardMembership"),
      vipMembership: t("vipMembership"),
      identityTitle: t("identityTitle"),
      passportTitle: t("passportTitle"),
      photosTitle: t("photosTitle"),
      videosTitle: t("videosTitle"),
      photoCountLabel: (count: number) => t("photoCountLabel", { count }),
      uploadPhotosPrompt: t("uploadPhotosPrompt"),
      phoneLabel: t("phoneLabel"),
      emailLabel: t("emailLabel"),
      passwordLabel: t("passwordLabel"),
      passwordValue: t("passwordValue"),
      inviteCodeLabel: t("inviteCodeLabel"),
      accountStatusLabel: t("accountStatusLabel"),
      lastLoginLabel: t("lastLoginLabel"),
      missingEmailForReset: t("missingEmailForReset"),
      resetSent: t("resetSent"),
      missingInviteCode: t("missingInviteCode"),
      inviteCopied: t("inviteCopied"),
      inviteCopyFailed: t("inviteCopyFailed"),
      profileSaved: t("profileSaved"),
      profileSavedRefreshing: t("profileSavedRefreshing"),
      profileChangeSubmitted: t("profileChangeSubmitted"),
      profileRequired: t("profileRequired"),
      identitySubmitted: t("identitySubmitted"),
      passportSubmitted: t("passportSubmitted"),
      photosUploaded: t("photosUploaded"),
      videosUploaded: t("videosUploaded"),
      photosDeleted: t("photosDeleted"),
      videosDeleted: t("videosDeleted"),
      identityDescription: t("identityDescription"),
      passportDescription: t("passportDescription"),
      mediaDescription: t("mediaDescription"),
      deletePhotos: t("deletePhotos"),
      uploadPhotos: t("uploadPhotos"),
      deleteVideos: t("deleteVideos"),
      uploadVideos: t("uploadVideos"),
    },
    sharedCopy: createDashboardSharedCopy(sharedT),
  };
}

export type DashboardSharedMyStateCopy = ReturnType<
  typeof useDashboardSharedMyStateCopy
>["copy"];

export type DashboardSharedCopy = ReturnType<typeof createDashboardSharedCopy>;
