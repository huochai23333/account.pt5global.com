/** 铃铛、未读角标与公告弹窗共用同一 Hook；这里不直接查询或保存阅读记录。 */
"use client";

import { useMemo } from "react";

import { Bell, LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";

import { useLocale } from "@/components/i18n/locale-provider";
import { MotionList, MotionListItem } from "@/components/motion/motion-primitives";
import { Button, InteractiveButton as DesignButton } from "@/components/ui/button";
import type { AnnouncementRow } from "@/lib/announcements";
import type { WorkspaceAnnouncementsState } from "@/lib/workspace-announcements";

import { DashboardDialog } from "./dashboard-dialog";
import { FeedbackNotice } from "./dashboard-shared-ui";
import { useWorkspaceHeaderAnnouncements } from "./use-workspace-header-announcements";

export function WorkspaceAnnouncementAction({
  initialAnnouncementsState,
}: {
  initialAnnouncementsState: WorkspaceAnnouncementsState;
}) {
  const t = useTranslations("DashboardShell");
  const { locale } = useLocale();
  const announcementsCopy = useMemo(
    () => ({
      loadError: t("announcements.loadError"),
      readError: t("announcements.readError"),
      readPartialError: t("announcements.readPartialError"),
    }),
    [t],
  );
  const announcements = useWorkspaceHeaderAnnouncements({
    copy: announcementsCopy,
    initialState: initialAnnouncementsState,
  });

  return (
    <>
      <DesignButton
        aria-label={t("announcements.open")}
        className="relative flex min-h-11 min-w-11 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface-interactive"
        disabled={announcements.loading}
        onClick={announcements.openRecentAnnouncements}
        type="button"
      >
        {announcements.loading ? (
          <LoaderCircle className="size-[18px] animate-spin" />
        ) : (
          <Bell className="size-[18px]" />
        )}
        {announcements.unreadCount > 0 ? (
          <span className="absolute right-0.5 top-0.5 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
            {announcements.unreadCount > 9 ? "9+" : announcements.unreadCount}
          </span>
        ) : null}
      </DesignButton>

      <DashboardDialog
        actions={
          announcements.unreadCount > 0 ? (
            <Button
              variant="primary"
              size="compact"
              disabled={announcements.markingRead}
              onClick={() => void announcements.acknowledgeAnnouncements()}
            >
              {announcements.markingRead ? <LoaderCircle className="size-4 animate-spin" /> : null}
              {t("announcements.acknowledge")}
            </Button>
          ) : undefined
        }
        description={
          announcements.dialogMode === "auto"
            ? t("announcements.newDescription")
            : t("announcements.recentDescription")
        }
        onOpenChange={announcements.closeDialog}
        open={announcements.dialogOpen}
        title={
          announcements.dialogMode === "auto"
            ? t("announcements.newTitle")
            : t("announcements.recentTitle")
        }
      >
        <MotionList className="space-y-4">
          {announcements.errorMessage ? (
            <FeedbackNotice tone="error">{announcements.errorMessage}</FeedbackNotice>
          ) : null}

          {announcements.displayedAnnouncements.length === 0 ? (
            <div className="rounded-surface-panel border border-border-subtle bg-surface-interactive p-6 text-sm leading-7 text-content-muted">
              {t("announcements.empty")}
            </div>
          ) : (
            announcements.displayedAnnouncements.map((announcement, index) => (
              <MotionListItem index={index} key={announcement.id}>
                <WorkspaceAnnouncementCard announcement={announcement} locale={locale} />
              </MotionListItem>
            ))
          )}
        </MotionList>
      </DashboardDialog>
    </>
  );
}

function WorkspaceAnnouncementCard({
  announcement,
  locale,
}: {
  announcement: AnnouncementRow;
  locale: string;
}) {
  const publishedAt = announcement.published_at ?? announcement.created_at;

  return (
    <article className="rounded-surface-panel border border-border-subtle bg-surface-interactive p-5 shadow-surface-interactive">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <h4 className="text-lg font-semibold text-content-strong">{announcement.title}</h4>
        <time className="shrink-0 text-xs font-medium text-content-muted">
          {formatWorkspaceAnnouncementDate(publishedAt, locale)}
        </time>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-content-muted">
        {announcement.content}
      </p>
    </article>
  );
}

function formatWorkspaceAnnouncementDate(value: string | null, locale: string) {
  if (!value) return "";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  }).format(new Date(value));
}
