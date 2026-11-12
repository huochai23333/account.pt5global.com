import type { AdminPeopleChangeLogRow } from "./admin-people-contract";
import type { AdminOperationActor, AdminOperationRecord } from "./admin-operation-records-contract";

type ProfileChangeStatus = "approved" | "rejected" | "pending";

export type ProfileChangeReviewHistoryRow = {
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

export type UserProfileSummary = {
  email: string | null;
  name: string | null;
  user_id: string;
};

// 账号日志已有当时的身份快照，资料审核只保存用户编号，需要补查当前姓名和邮箱。
export function toAccountOperationRecord(
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

export function toProfileOperationRecord(
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
