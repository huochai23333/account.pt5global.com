"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTranslations } from "next-intl";

import {
  getAdminReviewsPageData,
  type AdminReviewsPageData,
  type PendingMediaReviewWithPreview,
  type PendingPrivacyReviewRow,
} from "@/lib/admin-reviews";
import type { PendingProfileChangeReviewRow } from "@/lib/profile-change-requests";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  createDashboardSharedCopy,
  toErrorMessage,
  type FeedbackTone,
} from "../dashboard-shared-ui";
import { useWorkspaceSyncEffect } from "../workspace-session-provider";
import { useAdminReviewActions } from "./use-admin-review-actions";

import type { BusyAction, ReviewTab } from "./types";

type PageFeedback = { tone: FeedbackTone; message: string } | null;

export function useAdminReviewsPage(initialData: AdminReviewsPageData) {
  const t = useTranslations("Reviews");
  const sharedT = useTranslations("DashboardShared");
  const sharedCopy = useMemo(() => createDashboardSharedCopy(sharedT), [sharedT]);
  const supabase = getBrowserSupabaseClient();

  const [activeTab, setActiveTab] = useState<ReviewTab>("profile");
  const [hasPermission, setHasPermission] = useState(initialData.hasPermission);
  const [pageFeedback, setPageFeedback] = useState<PageFeedback>(null);
  const [privacyRows, setPrivacyRows] = useState<PendingPrivacyReviewRow[]>(initialData.privacyRows);
  const [mediaRows, setMediaRows] = useState<PendingMediaReviewWithPreview[]>(initialData.mediaRows);
  const [profileRows, setProfileRows] = useState<PendingProfileChangeReviewRow[]>(initialData.profileRows);
  const refreshVersion = useRef(0);
  const [previewAsset, setPreviewAsset] = useState<PendingMediaReviewWithPreview | null>(null);

  const applyPageData = useCallback((pageData: AdminReviewsPageData) => {
    setHasPermission(pageData.hasPermission);
    setPrivacyRows(pageData.privacyRows);
    setMediaRows(pageData.mediaRows);
    setProfileRows(pageData.profileRows);
  }, []);

  useEffect(() => {
    applyPageData(initialData);
  }, [applyPageData, initialData]);

  const refreshReviewsPage = useCallback(
    async ({ isMounted }: { isMounted: () => boolean }) => {
      if (!supabase) {
        return;
      }

      const version = ++refreshVersion.current;
      try {
        const nextPageData = await getAdminReviewsPageData(supabase);

        if (!isMounted() || version !== refreshVersion.current) {
          return;
        }

        applyPageData(nextPageData);
        setPageFeedback(null);
      } catch (error) {
        if (!isMounted() || version !== refreshVersion.current) {
          return;
        }

        setPageFeedback({
          tone: "error",
          message: toErrorMessage(error, sharedCopy),
        });
      }
    },
    [applyPageData, sharedCopy, supabase],
  );

  useWorkspaceSyncEffect(refreshReviewsPage);

  function removeConfirmedRow(tab: ReviewTab, id: string) {
    // 先前启动的列表读取可能还含有该行；审核确认后忽略这些旧结果。
    refreshVersion.current += 1;
    if (tab === "media") setMediaRows((rows) => rows.filter((row) => row.asset_id !== id));
    if (tab === "privacy") setPrivacyRows((rows) => rows.filter((row) => row.request_id !== id));
    if (tab === "profile") setProfileRows((rows) => rows.filter((row) => row.request_id !== id));
  }

  const { busyRows, runReview } = useAdminReviewActions(
    supabase,
    removeConfirmedRow,
    setPageFeedback,
    (error) => toErrorMessage(error, sharedCopy),
  );

  const closePreviewDialog = useCallback((open: boolean) => {
    if (open) {
      return;
    }

    setPreviewAsset(null);
  }, []);

  const reviewTabs = useMemo(
    () => [
      {
        key: "profile" as const,
        label: t("tabs.profile"),
        count: profileRows.length,
      },
      {
        key: "privacy" as const,
        label: t("tabs.privacy"),
        count: privacyRows.length,
      },
      {
        key: "media" as const,
        label: t("tabs.media"),
        count: mediaRows.length,
      },
    ],
    [mediaRows.length, privacyRows.length, profileRows.length, t],
  );

  return {
    activeTab,
    busyRows,
    closePreviewDialog,
    handleMediaReview: (row: PendingMediaReviewWithPreview, action: BusyAction) =>
      runReview({ tab: "media", id: row.asset_id, userId: row.user_id, action }),
    handleProfileChangeReview: (row: PendingProfileChangeReviewRow, action: BusyAction) =>
      runReview({ tab: "profile", id: row.request_id, userId: row.user_id, action }),
    handlePrivacyReview: (row: PendingPrivacyReviewRow, action: BusyAction) =>
      runReview({ tab: "privacy", id: row.request_id, userId: row.user_id, action }),
    hasPermission,
    mediaRows,
    pageFeedback,
    previewAsset,
    profileRows,
    privacyRows,
    reviewTabs,
    setActiveTab,
    setPreviewAsset,
  };
}
