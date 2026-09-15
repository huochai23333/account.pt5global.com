import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getVisibleAnnouncements,
  type AnnouncementRow,
} from "./announcements";
import { withRequestTimeout } from "./request-timeout";

type AnnouncementReadRow = {
  announcement_id: string;
};

export type WorkspaceAnnouncementsState = {
  announcements: AnnouncementRow[];
  unreadAnnouncements: AnnouncementRow[];
};

export const EMPTY_WORKSPACE_ANNOUNCEMENTS_STATE: WorkspaceAnnouncementsState = {
  announcements: [],
  unreadAnnouncements: [],
};

export async function getWorkspaceAnnouncementsState(
  supabase: SupabaseClient,
  limit = 5,
): Promise<WorkspaceAnnouncementsState> {
  const announcements = await getVisibleAnnouncements(supabase, limit);
  const announcementIds = announcements.map((announcement) => announcement.id);

  if (announcementIds.length === 0) {
    return {
      announcements,
      unreadAnnouncements: [],
    };
  }

  const readIds = await getReadAnnouncementIds(supabase, announcementIds);

  return {
    announcements,
    unreadAnnouncements: announcements.filter(
      (announcement) => !readIds.has(announcement.id),
    ),
  };
}

export async function markWorkspaceAnnouncementsRead(
  supabase: SupabaseClient,
  announcements: readonly Pick<AnnouncementRow, "id">[],
) {
  const uniqueIds = Array.from(
    new Set(announcements.map((announcement) => announcement.id)),
  );

  await Promise.all(
    uniqueIds.map(async (announcementId) => {
      const { data, error } = await withRequestTimeout(
        supabase.rpc("mark_announcement_read", {
          _announcement_id: announcementId,
        }),
      );

      if (error) {
        throw error;
      }

      if (
        typeof data !== "object"
        || data === null
        || !("announcement_id" in data)
        || data.announcement_id !== announcementId
      ) {
        throw new Error("公告阅读状态没有保存成功。");
      }
    }),
  );
}

async function getReadAnnouncementIds(
  supabase: SupabaseClient,
  announcementIds: string[],
) {
  const {
    data: { user },
    error: userError,
  } = await withRequestTimeout(supabase.auth.getUser());

  if (userError) {
    throw userError;
  }

  if (!user) {
    return new Set<string>();
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("user_announcement_reads")
      .select("announcement_id")
      .eq("user_id", user.id)
      .in("announcement_id", announcementIds)
      .returns<AnnouncementReadRow[]>(),
  );

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.announcement_id));
}
