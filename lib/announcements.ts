import { queryCompleteDashboardRows } from "./dashboard-complete-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getDashboardQueryRange } from "./dashboard-pagination";
import { withRequestTimeout } from "./request-timeout";
import {
  getCurrentSessionContext,
  type AppRole,
  type UserStatus,
} from "./user-self-service";

export type AnnouncementAudience = "client" | "internal" | "all";
export type AnnouncementStatus = "draft" | "published" | "offline";

export type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  audience: AnnouncementAudience;
  status: AnnouncementStatus;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  published_at: string | null;
};

export type AnnouncementFormInput = {
  audience: AnnouncementAudience;
  content: string;
  title: string;
};

export type AdminAnnouncementsPageData = {
  announcements: AnnouncementRow[];
  hasPermission: boolean;
};

type AnnouncementReaderContext = {
  role: AppRole | null;
  status: UserStatus | null;
};

export const ANNOUNCEMENT_SELECT =
  "id,title,content,audience,status,created_by_user_id,created_at,updated_at,published_at";

export function canManageAnnouncements(role: AppRole | null) {
  return role === "administrator";
}

export function canReadAnnouncements(
  role: AppRole | null,
  status: UserStatus | null,
) {
  return !!role && status === "active";
}

export async function getVisibleAnnouncements(
  supabase: SupabaseClient,
  limit = 5,
  context?: AnnouncementReaderContext,
) {
  const { role, status } =
    context ?? (await getCurrentSessionContext(supabase));

  if (!canReadAnnouncements(role, status)) {
    return [];
  }

  const audiences = getVisibleAnnouncementAudiences(role);
  // 界面按角色减少读取结果，数据库行级策略仍独立决定用户能看到哪些记录。
  const { from, to } = getDashboardQueryRange(limit);
  const { data, error } = await withRequestTimeout(
    supabase
      .from("announcements")
      .select(ANNOUNCEMENT_SELECT)
      .eq("status", "published")
      .in("audience", audiences)
      .order("published_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(from, to)
      .returns<AnnouncementRow[]>(),
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}

function getVisibleAnnouncementAudiences(
  role: AppRole | null,
): AnnouncementAudience[] {
  if (role === "client") {
    return ["all", "client"];
  }

  return ["all", "internal"];
}

export async function getAdminAnnouncementsPageData(
  supabase: SupabaseClient,
): Promise<AdminAnnouncementsPageData> {
  const { role } = await getCurrentSessionContext(supabase);

  if (!canManageAnnouncements(role)) {
    return {
      announcements: [],
      hasPermission: false,
    };
  }

  const { data, error } = await queryCompleteDashboardRows(
    supabase
      .from("announcements")
      .select(ANNOUNCEMENT_SELECT)
      .order("updated_at", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<AnnouncementRow[]>(),
  );

  if (error) {
    throw error;
  }

  return {
    announcements: data ?? [],
    hasPermission: true,
  };
}

export function sortAnnouncements(rows: readonly AnnouncementRow[]) {
  return [...rows].sort((left, right) => {
    return getAnnouncementSortTime(right) - getAnnouncementSortTime(left);
  });
}

function getAnnouncementSortTime(row: AnnouncementRow) {
  const value = row.updated_at ?? row.published_at ?? row.created_at;
  return value ? new Date(value).getTime() : 0;
}
