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

  const readerId = await getAnnouncementReaderId(supabase);
  if (!readerId) throw new Error("公告阅读状态没有保存成功。");

  // 每条公告独立写入。一条失败时也等待其余回执，避免重写已确认的阅读时间。
  const results = await Promise.allSettled(
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
        || !("user_id" in data)
        || data.user_id !== readerId
        || !("read_at" in data)
        || typeof data.read_at !== "string"
        || !Number.isFinite(Date.parse(data.read_at))
      ) {
        throw new Error("公告阅读状态没有保存成功。");
      }
    }),
  );

  const confirmedIds = new Set(uniqueIds.filter((_, index) => results[index].status === "fulfilled"));
  const unconfirmedIds = uniqueIds.filter((id) => !confirmedIds.has(id));
  if (unconfirmedIds.length > 0) {
    // 响应丢失后按当前用户和原编号读回，确认已落库的项目。
    try {
      const persistedIds = await getReadAnnouncementIds(supabase, unconfirmedIds, readerId);
      for (const id of persistedIds) confirmedIds.add(id);
    } catch {
      // 只移除已有明确凭证的项目，其余继续显示。
    }
  }
  if (confirmedIds.size === uniqueIds.length) {
    return { status: "succeeded", confirmedIds } as const;
  }
  return {
    status: confirmedIds.size > 0 ? "partial_failed" : "failed",
    confirmedIds,
  } as const;
}

async function getAnnouncementReaderId(supabase: SupabaseClient) {
  const {
    data: { user },
    error: userError,
  } = await withRequestTimeout(supabase.auth.getUser());

  if (userError) {
    throw userError;
  }

  return user?.id ?? null;
}

async function getReadAnnouncementIds(
  supabase: SupabaseClient,
  announcementIds: string[],
  readerId?: string,
) {
  const userId = readerId ?? await getAnnouncementReaderId(supabase);
  if (!userId) {
    return new Set<string>();
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("user_announcement_reads")
      .select("announcement_id")
      .eq("user_id", userId)
      .in("announcement_id", announcementIds)
      .returns<AnnouncementReadRow[]>(),
  );

  if (error) {
    throw error;
  }

  return new Set((data ?? []).map((row) => row.announcement_id));
}
