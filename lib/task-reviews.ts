import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeTaskScope } from "./admin-task-normalizers";
import { withRequestTimeout } from "./request-timeout";
import {
  getTaskReviewSubmissionAssets,
} from "./task-review-assets";
import type { TaskReviewSubmissionAsset } from "./task-review-assets";
export {
  downloadTaskReviewSubmissionAssetBlob,
  getTaskReviewSubmissionAssetSignedUrl,
  getTaskReviewSubmissionAssetsForTask,
  removeStoredTaskReviewSubmissionAssets,
  TASK_REVIEW_SUBMISSION_MAX_FILES,
  TASK_REVIEW_SUBMISSION_MAX_TOTAL_SIZE_BYTES,
  uploadTaskReviewSubmissionAssets,
  validateTaskReviewSubmissionFiles,
} from "./task-review-assets";
export type { TaskReviewSubmissionAsset } from "./task-review-assets";
import {
  normalizeInteger,
  normalizeNumericValue,
  normalizeOptionalString,
} from "./value-normalizers";

const PENDING_TASK_REVIEW_SELECT =
  "acceptance_id,task_id,task_name,task_intro,task_type_code,task_type_name,commission_amount_rmb,scope,team_id,team_name,accepted_by_user_id,accepted_by_name,accepted_by_email,submission_id,submission_round,submission_note,submitted_at,asset_count";

export type TaskReviewSubmissionStatus = "draft" | "pending" | "approved" | "rejected";

export type TaskReviewSubmissionRow = {
  id: string;
  acceptance_id: string;
  task_id: string;
  submitted_by_user_id: string;
  round_index: number;
  submission_note: string | null;
  status: TaskReviewSubmissionStatus;
  reviewer_user_id: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  reject_reason: string | null;
  created_at: string | null;
};

export type PendingTaskReviewRow = {
  acceptance_id: string;
  task_id: string;
  task_name: string;
  task_intro: string | null;
  task_type_code: string;
  task_type_name: string | null;
  commission_amount_rmb: number;
  scope: "public" | "team";
  team_id: string | null;
  team_name: string | null;
  accepted_by_user_id: string;
  accepted_by_name: string | null;
  accepted_by_email: string | null;
  submission_id: string;
  submission_round: number;
  submission_note: string | null;
  submitted_at: string | null;
  asset_count: number;
};

export type PendingTaskReviewWithAssets = PendingTaskReviewRow & {
  assets: TaskReviewSubmissionAsset[];
};

type PendingTaskReviewRecord = {
  acceptance_id: string | null;
  task_id: string | null;
  task_name: string | null;
  task_intro: string | null;
  task_type_code: string | null;
  task_type_name: string | null;
  commission_amount_rmb: number | string | null;
  scope: "public" | "team" | null;
  team_id: string | null;
  team_name: string | null;
  accepted_by_user_id: string | null;
  accepted_by_name: string | null;
  accepted_by_email: string | null;
  submission_id: string | null;
  submission_round: number | string | null;
  submission_note: string | null;
  submitted_at: string | null;
  asset_count: number | string | null;
};

export async function createTaskReviewSubmissionDraft(
  supabase: SupabaseClient,
  options: {
    acceptanceId: string;
    submissionNote?: string | null;
  },
) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("create_task_review_submission", {
      p_acceptance_id: options.acceptanceId,
      p_submission_note: normalizeOptionalString(options.submissionNote),
    }),
  );

  if (error) {
    throw error;
  }

  const submission = normalizeTaskReviewSubmissionRecord(data);

  if (!submission) {
    throw new Error("任务审核提交草稿创建成功，但返回数据不完整。");
  }

  return submission;
}

export async function cancelTaskReviewSubmissionDraft(
  supabase: SupabaseClient,
  submissionId: string,
) {
  // verified-rpc: 取消函数返回 void；随后按草稿编号确认记录已经删除。
  const { error } = await withRequestTimeout(
    supabase.rpc("cancel_task_review_submission", {
      p_submission_id: submissionId,
    }),
  );

  if (error) {
    throw error;
  }

  const { data: remaining, error: verificationError } = await withRequestTimeout(
    supabase
      .from("task_review_submissions")
      .select("id")
      .eq("id", submissionId)
      .maybeSingle<{ id: string }>(),
  );

  if (verificationError) throw verificationError;
  if (remaining) throw new Error("审核草稿没有取消成功，请刷新后重试。");
}

export async function submitTaskReview(
  supabase: SupabaseClient,
  options: {
    acceptanceId: string;
    submissionId: string;
  },
) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("submit_task_review", {
      p_acceptance_id: options.acceptanceId,
      p_submission_id: options.submissionId,
    }),
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function approveTaskReview(
  supabase: SupabaseClient,
  acceptanceId: string,
) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("approve_task_review", {
      p_acceptance_id: acceptanceId,
    }),
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function rejectTaskReview(
  supabase: SupabaseClient,
  options: {
    acceptanceId: string;
    reason?: string | null;
  },
) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("reject_task_review", {
      p_acceptance_id: options.acceptanceId,
      p_reason: normalizeOptionalString(options.reason),
    }),
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function getPendingTaskReviews(
  supabase: SupabaseClient,
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("pending_task_reviews")
      .select(PENDING_TASK_REVIEW_SELECT)
      .order("submitted_at", { ascending: false })
      .returns<PendingTaskReviewRecord[]>(),
  );

  if (error) {
    throw error;
  }

  const rows = (data ?? [])
    .map((item) => normalizePendingTaskReviewRecord(item))
    .filter((item): item is PendingTaskReviewRow => item !== null);

  if (rows.length === 0) {
    return [];
  }

  const submissionIds = rows.map((row) => row.submission_id);
  const assets = await getTaskReviewSubmissionAssets(supabase, submissionIds);
  const assetsBySubmissionId = new Map<string, TaskReviewSubmissionAsset[]>();

  assets.forEach((asset) => {
    const bucket = assetsBySubmissionId.get(asset.submission_id);

    if (bucket) {
      bucket.push(asset);
      return;
    }

    assetsBySubmissionId.set(asset.submission_id, [asset]);
  });

  return rows.map((row) => ({
    ...row,
    assets: assetsBySubmissionId.get(row.submission_id) ?? [],
  }));
}

function normalizeTaskReviewSubmissionRecord(
  value: unknown,
): TaskReviewSubmissionRow | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const id = "id" in value ? normalizeOptionalString(value.id) : null;
  const acceptanceId =
    "acceptance_id" in value ? normalizeOptionalString(value.acceptance_id) : null;
  const taskId = "task_id" in value ? normalizeOptionalString(value.task_id) : null;
  const submittedByUserId =
    "submitted_by_user_id" in value
      ? normalizeOptionalString(value.submitted_by_user_id)
      : null;
  const roundIndex =
    "round_index" in value ? normalizeInteger(value.round_index) : null;
  const status =
    "status" in value ? normalizeTaskReviewSubmissionStatus(value.status) : null;

  if (!id || !acceptanceId || !taskId || !submittedByUserId || !roundIndex || !status) {
    return null;
  }

  return {
    id,
    acceptance_id: acceptanceId,
    task_id: taskId,
    submitted_by_user_id: submittedByUserId,
    round_index: roundIndex,
    submission_note:
      "submission_note" in value ? normalizeOptionalString(value.submission_note) : null,
    status,
    reviewer_user_id:
      "reviewer_user_id" in value ? normalizeOptionalString(value.reviewer_user_id) : null,
    submitted_at: "submitted_at" in value ? normalizeOptionalString(value.submitted_at) : null,
    reviewed_at: "reviewed_at" in value ? normalizeOptionalString(value.reviewed_at) : null,
    reject_reason:
      "reject_reason" in value ? normalizeOptionalString(value.reject_reason) : null,
    created_at: "created_at" in value ? normalizeOptionalString(value.created_at) : null,
  };
}

function normalizePendingTaskReviewRecord(
  value: unknown,
): PendingTaskReviewRow | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const taskId = "task_id" in value ? normalizeOptionalString(value.task_id) : null;
  const acceptanceId =
    "acceptance_id" in value ? normalizeOptionalString(value.acceptance_id) : null;
  const taskName = "task_name" in value ? normalizeOptionalString(value.task_name) : null;
  const taskTypeCode =
    "task_type_code" in value ? normalizeOptionalString(value.task_type_code) : null;
  const acceptedByUserId =
    "accepted_by_user_id" in value
      ? normalizeOptionalString(value.accepted_by_user_id)
      : null;
  const submissionId =
    "submission_id" in value ? normalizeOptionalString(value.submission_id) : null;
  const submissionRound =
    "submission_round" in value ? normalizeInteger(value.submission_round) : null;
  const scope = "scope" in value ? normalizeTaskScope(value.scope) : null;

  if (
    !acceptanceId
    || !taskId
    || !taskName
    || !taskTypeCode
    || !acceptedByUserId
    || !submissionId
    || !submissionRound
    || !scope
  ) {
    return null;
  }

  return {
    acceptance_id: acceptanceId,
    task_id: taskId,
    task_name: taskName,
    task_intro: "task_intro" in value ? normalizeOptionalString(value.task_intro) : null,
    task_type_code: taskTypeCode,
    task_type_name:
      "task_type_name" in value ? normalizeOptionalString(value.task_type_name) : null,
    commission_amount_rmb:
      "commission_amount_rmb" in value
        ? normalizeNumericValue(value.commission_amount_rmb) ?? 0
        : 0,
    scope,
    team_id: "team_id" in value ? normalizeOptionalString(value.team_id) : null,
    team_name: "team_name" in value ? normalizeOptionalString(value.team_name) : null,
    accepted_by_user_id: acceptedByUserId,
    accepted_by_name:
      "accepted_by_name" in value ? normalizeOptionalString(value.accepted_by_name) : null,
    accepted_by_email:
      "accepted_by_email" in value ? normalizeOptionalString(value.accepted_by_email) : null,
    submission_id: submissionId,
    submission_round: submissionRound,
    submission_note:
      "submission_note" in value ? normalizeOptionalString(value.submission_note) : null,
    submitted_at: "submitted_at" in value ? normalizeOptionalString(value.submitted_at) : null,
    asset_count: "asset_count" in value ? normalizeInteger(value.asset_count) : 0,
  };
}

function normalizeTaskReviewSubmissionStatus(
  value: unknown,
): TaskReviewSubmissionStatus | null {
  if (
    value === "draft"
    || value === "pending"
    || value === "approved"
    || value === "rejected"
  ) {
    return value;
  }

  return null;
}
