import type { SupabaseClient } from "@supabase/supabase-js";

import { ANNOUNCEMENT_SELECT, type AnnouncementFormInput, type AnnouncementRow } from "./announcements";
import { withRequestTimeout } from "./request-timeout";

// 写入使用当前登录会话，表策略决定谁可维护。回执必须带实际影响的记录。
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

  if (!data?.id || data.status !== "draft") {
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

  if (data?.id !== announcementId) {
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

  if (data?.id !== announcementId) {
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
  status: "published" | "offline",
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

  // 状态与发布时间均由数据库返回，页面收到对应终态才更新。
  if (data?.id !== announcementId) {
    throw new Error("Announcement was not found.");
  }
  if (data.status !== status || (status === "published" ? !data.published_at : data.published_at !== null)) {
    throw new Error("Announcement status was not confirmed.");
  }

  return data;
}
