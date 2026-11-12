"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { useTranslations } from "next-intl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";
import { deleteAnnouncement, publishAnnouncement, takeAnnouncementOffline } from "@/lib/announcement-mutations";
import { sortAnnouncements, type AnnouncementRow } from "@/lib/announcements";
import { markBrowserCloudSyncActivity } from "@/lib/browser-sync-recovery";
import type { FeedbackTone } from "../dashboard-shared-ui";
import { toAnnouncementErrorMessage } from "./announcements-display";

type RowAction = "delete" | "offline" | "publish";
type ActionCopy = Parameters<typeof toAnnouncementErrorMessage>[1] & {
  deleteConfirm: (title: string) => string;
  deleteSuccess: string;
  offlineSuccess: string;
  publishSuccess: string;
};

export function useAnnouncementRowActions({ copy, setAnnouncements, setPageFeedback, supabase }: {
  copy: ActionCopy;
  setAnnouncements: Dispatch<SetStateAction<AnnouncementRow[]>>;
  setPageFeedback: (feedback: { tone: FeedbackTone; message: string } | null) => void;
  supabase: SupabaseClient | null;
}) {
  const confirm = useDashboardConfirm();
  const t = useTranslations("DashboardFramework.confirm");
  const writing = useRef(false);
  const [pendingAction, setPendingAction] = useState<{ id: string; type: RowAction } | null>(null);

  async function handleRowAction(type: RowAction, row: AnnouncementRow) {
    if (!supabase || writing.current) return;

    // 删除确认打开前先锁定动作，防止连点创建多个确认或并行修改同一列表。
    writing.current = true;
    try {
      if (type === "delete" && !(await confirm({
        description: copy.deleteConfirm(row.title), title: t("title"), tone: "danger",
      }))) return;

      setPendingAction({ id: row.id, type });
      setPageFeedback(null);
      if (type === "delete") {
        await deleteAnnouncement(supabase, row.id);
        setAnnouncements((rows) => rows.filter(({ id }) => id !== row.id));
        setPageFeedback({ tone: "success", message: copy.deleteSuccess });
      } else {
        const publish = type === "publish";
        const update = publish ? publishAnnouncement : takeAnnouncementOffline;
        const saved = await update(supabase, row.id);
        setAnnouncements((rows) => sortAnnouncements(rows.map((item) => item.id === row.id ? saved : item)));
        setPageFeedback({ tone: "success", message: publish ? copy.publishSuccess : copy.offlineSuccess });
      }
      markBrowserCloudSyncActivity();
    } catch (error) {
      setPageFeedback({ tone: "error", message: toAnnouncementErrorMessage(error, copy) });
    } finally {
      writing.current = false;
      setPendingAction(null);
    }
  }

  return { handleRowAction, pendingAction };
}
