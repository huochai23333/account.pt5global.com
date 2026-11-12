import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import { normalizeInteger, normalizeOptionalString } from "./value-normalizers";

// 执行人员操作草稿和发起审核，最终状态由提审读回流程确认。
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

function normalizeTaskReviewSubmissionRecord(value: unknown): TaskReviewSubmissionRow | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const id = "id" in value ? normalizeOptionalString(value.id) : null;
  const acceptanceId =
    "acceptance_id" in value ? normalizeOptionalString(value.acceptance_id) : null;
  const taskId = "task_id" in value ? normalizeOptionalString(value.task_id) : null;
  const submittedByUserId =
    "submitted_by_user_id" in value ? normalizeOptionalString(value.submitted_by_user_id) : null;
  const roundIndex = "round_index" in value ? normalizeInteger(value.round_index) : null;
  const status = "status" in value ? normalizeTaskReviewSubmissionStatus(value.status) : null;

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
    reject_reason: "reject_reason" in value ? normalizeOptionalString(value.reject_reason) : null,
    created_at: "created_at" in value ? normalizeOptionalString(value.created_at) : null,
  };
}

function normalizeTaskReviewSubmissionStatus(value: unknown): TaskReviewSubmissionStatus | null {
  if (value === "draft" || value === "pending" || value === "approved" || value === "rejected") {
    return value;
  }

  return null;
}
