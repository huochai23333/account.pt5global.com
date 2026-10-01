"use client";

import { DashboardPagedRecords } from "../dashboard-paged-records";

import { FileBadge2, ImageIcon, UserRound } from "lucide-react";
import { useTranslations } from "next-intl";

import type { AdminReviewsPageData } from "@/lib/admin-reviews";

import { DashboardSegmentedTabs } from "@/components/dashboard/dashboard-segmented-tabs";
import { DashboardSectionHeader } from "@/components/dashboard/dashboard-section-header";
import {
  DashboardAccessState,
  DashboardPageShell,
} from "@/components/dashboard/dashboard-page-shell";
import { DashboardListSection } from "@/components/dashboard/dashboard-section-panel";
import { PrivacyReviewList } from "./admin-reviews-ui";
import { MediaPreviewDialog, MediaReviewList } from "./media-review-list";
import { ProfileChangeReviewList } from "./profile-change-review-list";
import { useAdminReviewsPage } from "./use-admin-reviews-page";

const reviewTabIconMap = {
  media: ImageIcon,
  profile: UserRound,
  privacy: FileBadge2,
} as const;

export function AdminReviewsClient({
  initialData,
}: {
  initialData: AdminReviewsPageData;
}) {
  const t = useTranslations("Reviews");
  const {
    activeTab,
    busyRows,
    closePreviewDialog,
    handleMediaReview,
    handleProfileChangeReview,
    handlePrivacyReview,
    hasPermission,
    mediaRows,
    pageFeedback,
    previewAsset,
    profileRows,
    privacyRows,
    reviewTabs,
    setActiveTab,
    setPreviewAsset,
  } = useAdminReviewsPage(initialData);

  return (
    <DashboardPageShell
      feedback={pageFeedback}
      header={
        <DashboardSectionHeader
          presentation="work"
          title={t("header.title")}
        />
      }
    >
      {hasPermission === false ? (
        <DashboardAccessState
          description={t("states.noPermissionDescription")}
          kind="permission"
          title={t("states.noPermissionTitle")}
        />
      ) : (
        <DashboardListSection className="p-4 sm:p-6 xl:p-8">
          <DashboardSegmentedTabs
            onChange={setActiveTab}
            options={reviewTabs.map((tab) => {
              const Icon = reviewTabIconMap[tab.key];

              return {
                badge: tab.count,
                icon: <Icon className="size-4" />,
                key: tab.key,
                label: tab.label,
              };
            })}
            value={activeTab}
          />

          <div className="mt-6">
            {activeTab === "profile" ? (
              <DashboardPagedRecords items={profileRows} queryKey={activeTab}>{(pageRows) => <ProfileChangeReviewList
                busyRows={busyRows}
                onAction={handleProfileChangeReview}
                rows={pageRows}
              />}</DashboardPagedRecords>
            ) : null}

            {activeTab === "privacy" ? (
              <DashboardPagedRecords items={privacyRows} queryKey={activeTab}>{(pageRows) => <PrivacyReviewList
                busyRows={busyRows}
                onAction={handlePrivacyReview}
                rows={pageRows}
              />}</DashboardPagedRecords>
            ) : null}

            {activeTab === "media" ? (
              <DashboardPagedRecords items={mediaRows} queryKey={activeTab}>{(pageRows) => <MediaReviewList
                busyRows={busyRows}
                onAction={handleMediaReview}
                onPreviewOpen={setPreviewAsset}
                rows={pageRows}
              />}</DashboardPagedRecords>
            ) : null}
          </div>
        </DashboardListSection>
      )}

      <MediaPreviewDialog
        asset={previewAsset}
        onOpenChange={closePreviewDialog}
      />
    </DashboardPageShell>
  );
}
