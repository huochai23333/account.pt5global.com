import { queryCompleteDashboardRows } from "./dashboard-complete-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeAppRole } from "./auth-metadata";
import { withRequestTimeout } from "./request-timeout";
import {
  getCurrentSessionContext,
  type AppRole,
  type UserStatus,
} from "./user-self-service";
import { normalizeOptionalString } from "./value-normalizers";

export const WORKSPACE_FEEDBACK_TYPE_OPTIONS = ["bug", "suggestion"] as const;
export const WORKSPACE_FEEDBACK_STATUS_OPTIONS = [
  "new",
  "in_progress",
  "resolved",
  "declined",
] as const;

export type WorkspaceFeedbackType =
  (typeof WORKSPACE_FEEDBACK_TYPE_OPTIONS)[number];
export type WorkspaceFeedbackStatus =
  (typeof WORKSPACE_FEEDBACK_STATUS_OPTIONS)[number];

export type WorkspaceFeedbackRow = {
  id: string;
  submitted_by_user_id: string;
  submitted_role: AppRole | null;
  feedback_type: WorkspaceFeedbackType;
  title: string;
  content: string;
  source_path: string;
  status: WorkspaceFeedbackStatus;
  status_updated_at: string;
  status_updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminWorkspaceFeedbackItem = WorkspaceFeedbackRow & {
  submitter_email: string | null;
  submitter_name: string | null;
};

export type AdminWorkspaceFeedbackPageData = {
  feedback: AdminWorkspaceFeedbackItem[];
  hasPermission: boolean;
};

export type WorkspaceFeedbackSubmitInput = {
  content: string;
  feedbackType: WorkspaceFeedbackType;
  sourcePath: string;
  title: string;
};

const WORKSPACE_FEEDBACK_SELECT =
  "id,submitted_by_user_id,submitted_role,feedback_type,title,content,source_path,status,status_updated_at,status_updated_by_user_id,created_at,updated_at";
const WORKSPACE_FEEDBACK_MUTATION_TIMEOUT_MS = 20_000;

const workspaceFeedbackTypeSet = new Set<string>(WORKSPACE_FEEDBACK_TYPE_OPTIONS);
const workspaceFeedbackStatusSet = new Set<string>(
  WORKSPACE_FEEDBACK_STATUS_OPTIONS,
);

export function canManageWorkspaceFeedback(
  role: AppRole | null,
  status: UserStatus | null,
) {
  return role === "administrator" && status === "active";
}

export function isWorkspaceFeedbackType(
  value: unknown,
): value is WorkspaceFeedbackType {
  return typeof value === "string" && workspaceFeedbackTypeSet.has(value);
}

export function isWorkspaceFeedbackStatus(
  value: unknown,
): value is WorkspaceFeedbackStatus {
  return typeof value === "string" && workspaceFeedbackStatusSet.has(value);
}

export async function submitWorkspaceFeedback(
  supabase: SupabaseClient,
  input: WorkspaceFeedbackSubmitInput,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .rpc("submit_workspace_feedback", {
        _content: input.content,
        _feedback_type: input.feedbackType,
        _source_path: input.sourcePath,
        _title: input.title,
      })
      .maybeSingle<WorkspaceFeedbackRow>(),
    {
      timeoutMs: WORKSPACE_FEEDBACK_MUTATION_TIMEOUT_MS,
    },
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("feedback_submit_failed");
  }

  const feedback = normalizeWorkspaceFeedbackRow(data);

  if (!feedback) {
    throw new Error("feedback_submit_failed");
  }

  return feedback;
}

export async function getAdminWorkspaceFeedbackPageData(
  supabase: SupabaseClient,
): Promise<AdminWorkspaceFeedbackPageData> {
  const { role, status } = await getCurrentSessionContext(supabase);

  if (!canManageWorkspaceFeedback(role, status)) {
    return {
      feedback: [],
      hasPermission: false,
    };
  }

  const { data, error } = await queryCompleteDashboardRows(
    supabase
      .from("workspace_feedback")
      .select(WORKSPACE_FEEDBACK_SELECT)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<WorkspaceFeedbackRow[]>(),
  );

  if (error) {
    throw error;
  }

  const rows = normalizeWorkspaceFeedbackRows(data);
  const submitters = await getFeedbackSubmitters(supabase, rows);

  return {
    feedback: rows.map((row) => ({
      ...row,
      submitter_email: submitters.get(row.submitted_by_user_id)?.email ?? null,
      submitter_name: submitters.get(row.submitted_by_user_id)?.name ?? null,
    })),
    hasPermission: true,
  };
}

export async function updateWorkspaceFeedbackStatus(
  supabase: SupabaseClient,
  feedbackId: string,
  status: WorkspaceFeedbackStatus,
) {
  if (!feedbackId || !isWorkspaceFeedbackStatus(status)) {
    throw new Error("feedback_invalid_status");
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .rpc("update_workspace_feedback_status", {
        _feedback_id: feedbackId,
        _status: status,
      })
      .maybeSingle<WorkspaceFeedbackRow>(),
    {
      timeoutMs: WORKSPACE_FEEDBACK_MUTATION_TIMEOUT_MS,
    },
  );

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("feedback_update_failed");
  }

  const feedback = normalizeWorkspaceFeedbackRow(data);

  if (!feedback) {
    throw new Error("feedback_update_failed");
  }

  return feedback;
}

export function sortWorkspaceFeedback(
  feedback: readonly AdminWorkspaceFeedbackItem[],
) {
  return [...feedback].sort((left, right) => {
    return getWorkspaceFeedbackSortTime(right) - getWorkspaceFeedbackSortTime(left);
  });
}

function normalizeWorkspaceFeedbackRows(
  value: WorkspaceFeedbackRow[] | null,
): WorkspaceFeedbackRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => normalizeWorkspaceFeedbackRow(item))
    .filter((item): item is WorkspaceFeedbackRow => item !== null);
}

function normalizeWorkspaceFeedbackRow(
  value: WorkspaceFeedbackRow | null,
): WorkspaceFeedbackRow | null {
  if (!value || !isWorkspaceFeedbackType(value.feedback_type)) {
    return null;
  }

  if (!isWorkspaceFeedbackStatus(value.status)) {
    return null;
  }

  return {
    id: value.id,
    submitted_by_user_id: value.submitted_by_user_id,
    submitted_role: normalizeAppRole(value.submitted_role),
    feedback_type: value.feedback_type,
    title: value.title,
    content: value.content,
    source_path: value.source_path,
    status: value.status,
    status_updated_at: value.status_updated_at,
    status_updated_by_user_id: value.status_updated_by_user_id,
    created_at: value.created_at,
    updated_at: value.updated_at,
  };
}

async function getFeedbackSubmitters(
  supabase: SupabaseClient,
  rows: readonly WorkspaceFeedbackRow[],
) {
  const userIds = [...new Set(rows.map((row) => row.submitted_by_user_id))];
  const submitters = new Map<string, { email: string | null; name: string | null }>();

  if (userIds.length === 0) {
    return submitters;
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("user_profiles")
      .select("user_id,name,email")
      .in("user_id", userIds)
      .returns<Array<{ email: string | null; name: string | null; user_id: string }>>(),
  );

  if (error) {
    throw error;
  }

  (data ?? []).forEach((profile) => {
    submitters.set(profile.user_id, {
      email: normalizeOptionalString(profile.email),
      name: normalizeOptionalString(profile.name),
    });
  });

  return submitters;
}

function getWorkspaceFeedbackSortTime(row: WorkspaceFeedbackRow) {
  const value = row.created_at ?? row.updated_at;

  return value ? new Date(value).getTime() : 0;
}
