import { queryCompleteDashboardRows } from "./dashboard-complete-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getDashboardQueryRange,
} from "./dashboard-pagination";
import { withRequestTimeout } from "./request-timeout";
import {
  getCurrentSessionContext,
  type AppRole,
  type UserStatus,
} from "./user-self-service";

export type AnnouncementAudience = "client" | "internal" | "all";
export type AnnouncementStatus = "draft" | "published" | "offline";
export type AnnouncementFilterValue = AnnouncementAudience | AnnouncementStatus | "all";

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

const ANNOUNCEMENT_SELECT =
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

export async function createAnnouncement(
  supabase: SupabaseClient,
  input: AnnouncementFormInput,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("announcements")
      .insert(toAnnouncementPayload(input))
      .select(ANNOUNCEMENT_SELECT)
      .maybeSingle<AnnouncementRow>(),
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Announcement was not created.");
  }

  return data;
}

export async function updateAnnouncement(
  supabase: SupabaseClient,
  announcementId: string,
  input: AnnouncementFormInput,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("announcements")
      .update(toAnnouncementPayload(input))
      .eq("id", announcementId)
      .select(ANNOUNCEMENT_SELECT)
      .maybeSingle<AnnouncementRow>(),
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Announcement was not found.");
  }

  return data;
}

export async function deleteAnnouncement(
  supabase: SupabaseClient,
  announcementId: string,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("announcements")
      .delete()
      .eq("id", announcementId)
      .select("id")
      .maybeSingle<{ id: string }>(),
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Announcement was not found.");
  }

  return data;
}

export async function publishAnnouncement(
  supabase: SupabaseClient,
  announcementId: string,
) {
  return updateAnnouncementStatus(supabase, announcementId, "published");
}

export async function takeAnnouncementOffline(
  supabase: SupabaseClient,
  announcementId: string,
) {
  return updateAnnouncementStatus(supabase, announcementId, "offline");
}

export function sortAnnouncements(rows: readonly AnnouncementRow[]) {
  return [...rows].sort((left, right) => {
    return getAnnouncementSortTime(right) - getAnnouncementSortTime(left);
  });
}

function toAnnouncementPayload(input: AnnouncementFormInput) {
  return {
    audience: input.audience,
    content: input.content.trim(),
    title: input.title.trim(),
  };
}

async function updateAnnouncementStatus(
  supabase: SupabaseClient,
  announcementId: string,
  status: AnnouncementStatus,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("announcements")
      .update({ status })
      .eq("id", announcementId)
      .select(ANNOUNCEMENT_SELECT)
      .maybeSingle<AnnouncementRow>(),
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Announcement was not found.");
  }

  return data;
}

function getAnnouncementSortTime(row: AnnouncementRow) {
  const value = row.updated_at ?? row.published_at ?? row.created_at;
  return value ? new Date(value).getTime() : 0;
}
