import { queryCompleteDashboardRows } from "./dashboard-complete-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  getAdminPeopleChangeLogDirectory,
  type AdminPeopleChangeLogRow,
} from "./admin-people";
import type { AppRole } from "./auth-routing";
import { getCurrentSessionContext, type UserStatus } from "./user-self-service";
import { normalizeOptionalString } from "./value-normalizers";
export const ADMIN_OPERATION_RECORD_CATEGORIES = [
  "account",
  "profile",
] as const;

export const ADMIN_OPERATION_RECORD_ACTIONS = [
  "account_changed",
  "profile_approved",
  "profile_rejected",
] as const;

export type AdminOperationRecordCategory =
  (typeof ADMIN_OPERATION_RECORD_CATEGORIES)[number];
export type AdminOperationRecordAction =
  (typeof ADMIN_OPERATION_RECORD_ACTIONS)[number];

export type AdminOperationActor = {
  email: string | null;
  name: string | null;
  userId: string | null;
};

export type AdminOperationRecord = {
  action: AdminOperationRecordAction;
  actor: AdminOperationActor;
  category: AdminOperationRecordCategory;
  cityChange: OperationValueChange | null;
  id: string;
  nameChange: OperationValueChange | null;
  note: string | null;
  occurredAt: string;
  roleChange: OperationValueChange<AppRole | null> | null;
  statusChange: OperationValueChange<
    UserStatus | null
  > | null;
  subject: AdminOperationActor;
};

export type AdminOperationRecordsPageData = {
  hasPermission: boolean;
  records: AdminOperationRecord[];
};

type OperationValueChange<T = string | null> = {
  from: T;
  to: T;
};

type ProfileChangeStatus = "approved" | "rejected" | "pending";

type ProfileChangeReviewHistoryRow = {
  id: string;
  previous_city: string | null;
  previous_name: string | null;
  requested_city: string;
  requested_name: string;
  reviewed_at: string | null;
  reviewer_user_id: string | null;
  status: ProfileChangeStatus;
  updated_at: string;
  user_id: string;
};

type UserProfileSummary = {
  email: string | null;
  name: string | null;
  user_id: string;
};


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

function toAccountOperationRecord(
  row: AdminPeopleChangeLogRow,
): AdminOperationRecord {
  return {
    action: "account_changed",
    actor: {
      email: row.actor_email,
      name: row.actor_name,
      userId: row.actor_user_id,
    },
    category: "account",
    cityChange:
      row.previous_city !== row.next_city
        ? {
            from: row.previous_city,
            to: row.next_city,
          }
        : null,
    id: `account:${row.id}`,
    nameChange: null,
    note: row.note,
    occurredAt: row.created_at,
    roleChange: {
      from: row.previous_role,
      to: row.next_role,
    },
    statusChange: {
      from: row.previous_status,
      to: row.next_status,
    },
    subject: {
      email: row.target_email,
      name: row.target_name,
      userId: row.target_user_id,
    },
  };
}

function toProfileOperationRecord(
  row: ProfileChangeReviewHistoryRow,
  profiles: ReadonlyMap<string, UserProfileSummary>,
): AdminOperationRecord {
  return {
    action: row.status === "approved" ? "profile_approved" : "profile_rejected",
    actor: toOperationActor(row.reviewer_user_id, profiles),
    category: "profile",
    cityChange: {
      from: row.previous_city,
      to: row.requested_city,
    },
    id: `profile:${row.id}`,
    nameChange: {
      from: row.previous_name,
      to: row.requested_name,
    },
    note: null,
    occurredAt: row.reviewed_at ?? row.updated_at,
    roleChange: null,
    statusChange: null,
    subject: toOperationActor(row.user_id, profiles),
  };
}

function toOperationActor(
  userId: string | null,
  profiles: ReadonlyMap<string, UserProfileSummary>,
): AdminOperationActor {
  const profile = userId ? profiles.get(userId) : null;

  return {
    email: profile?.email ?? null,
    name: profile?.name ?? null,
    userId,
  };
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
