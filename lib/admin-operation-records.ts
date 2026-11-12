import "server-only";

import { queryCompleteDashboardRows } from "./dashboard-complete-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getAdminPeopleChangeLogDirectory } from "./admin-people";
import type { AppRole } from "./auth-routing";
import { getCurrentSessionContext, type UserStatus } from "./user-self-service";
import { normalizeOptionalString } from "./value-normalizers";
import type { AdminOperationRecordsPageData } from "./admin-operation-records-contract";
import {
  toAccountOperationRecord,
  toProfileOperationRecord,
  type ProfileChangeReviewHistoryRow,
  type UserProfileSummary,
} from "./admin-operation-records-mapping";

export function canViewAdminOperationRecords(
  role: AppRole | null,
  status: UserStatus | null,
) {
  return role === "administrator" && status === "active";
}

export async function getAdminOperationRecordsPageData(
  supabase: SupabaseClient,
): Promise<AdminOperationRecordsPageData> {
  const { role, status } = await getCurrentSessionContext(supabase);

  if (!canViewAdminOperationRecords(role, status)) {
    return {
      hasPermission: false,
      records: [],
    };
  }

  // 操作记录只汇总现有账号调整与资料审核，避免读取已移除板块的数据。
  const [accountRows, profileRows] = await Promise.all([
    getAdminPeopleChangeLogDirectory(supabase),
    getProfileChangeReviewHistory(supabase),
  ]);
  const profiles = await getOperationUserProfiles(supabase, [
    ...profileRows.flatMap((row) => [row.user_id, row.reviewer_user_id]),
  ]);

  const records = [
    ...accountRows.map(toAccountOperationRecord),
    ...profileRows.map((row) => toProfileOperationRecord(row, profiles)),
  ].sort((left, right) => {
    return (
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime() || right.id.localeCompare(left.id)
    );
  });

  return {
    hasPermission: true,
    records,
  };
}

async function getProfileChangeReviewHistory(
  supabase: SupabaseClient,
) {
  const { data, error } = await queryCompleteDashboardRows(
    supabase
      .from("user_profile_change_requests")
      .select(
        "id,user_id,previous_name,requested_name,previous_city,requested_city,status,reviewer_user_id,reviewed_at,updated_at",
      )
      .neq("status", "pending")
      .order("reviewed_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .returns<ProfileChangeReviewHistoryRow[]>(),
  );

  if (error) {
    throw error;
  }

  return (data ?? []).filter(isProfileChangeReviewHistoryRow);
}

async function getOperationUserProfiles(
  supabase: SupabaseClient,
  rawUserIds: readonly (string | null)[],
) {
  const userIds = [
    ...new Set(rawUserIds.filter((value): value is string => !!value)),
  ];
  const profiles = new Map<string, UserProfileSummary>();

  if (userIds.length === 0) {
    return profiles;
  }

  const { data, error } = await queryCompleteDashboardRows(
    supabase
      .from("user_profiles")
      .select("user_id,name,email")
      .in("user_id", userIds).order("user_id")
      .returns<UserProfileSummary[]>(),
  );

  if (error) {
    throw error;
  }

  (data ?? []).forEach((profile) => {
    profiles.set(profile.user_id, {
      email: normalizeOptionalString(profile.email),
      name: normalizeOptionalString(profile.name),
      user_id: profile.user_id,
    });
  });

  return profiles;
}

function isProfileChangeReviewHistoryRow(
  value: ProfileChangeReviewHistoryRow,
): value is ProfileChangeReviewHistoryRow {
  return (
    typeof value.id === "string" &&
    typeof value.user_id === "string" &&
    typeof value.requested_name === "string" &&
    typeof value.requested_city === "string" &&
    (value.status === "approved" || value.status === "rejected") &&
    typeof value.updated_at === "string"
  );
}
