import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import { normalizeOptionalString } from "./value-normalizers";

type ReviewDecision = {
  action: "approve" | "reject";
  acceptanceId: string;
  submissionId: string;
  reason?: string | null;
};

type DecisionReceipt = {
  id: string;
  current_submission_id: string;
  status: string;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  review_reject_reason: string | null;
};

type SubmissionReadback = {
  id: string;
  acceptance_id: string;
  status: string;
  reviewed_at: string | null;
  reviewer_user_id: string | null;
  reject_reason: string | null;
};

export class TaskReviewDecisionUnconfirmedError extends Error {
  constructor() {
    super("Task review decision could not be confirmed");
  }
}

export async function decideTaskReview(supabase: SupabaseClient, decision: ReviewDecision) {
  const approved = decision.action === "approve";
  const reason = approved ? null : normalizeOptionalString(decision.reason);
  const identifiers = {
    p_acceptance_id: decision.acceptanceId,
    p_submission_id: decision.submissionId,
  };

  // 提交编号来自管理员看到的卡片。数据库持有领取行锁后比较这个编号。
  const { data, error } = await withRequestTimeout(
    approved
      ? supabase.rpc("approve_task_review", identifiers).single<DecisionReceipt>()
      : supabase.rpc("reject_task_review", { ...identifiers, p_reason: reason }).single<DecisionReceipt>(),
  );
  if (error) throw error;
  if (
    data?.id !== decision.acceptanceId ||
    data.current_submission_id !== decision.submissionId ||
    data.status !== (approved ? "completed" : "rejected") ||
    !data.reviewed_at ||
    !data.reviewed_by_user_id ||
    data.review_reject_reason !== reason
  ) {
    throw new TaskReviewDecisionUnconfirmedError();
  }

  // 单独读取该轮提交，确认审核结果与回执来自同一轮、同一次审核。
  const readback = await withRequestTimeout(
    supabase
      .from("task_review_submissions")
      .select("id,acceptance_id,status,reviewed_at,reviewer_user_id,reject_reason")
      .eq("id", decision.submissionId)
      .maybeSingle<SubmissionReadback>(),
  ).catch(() => null);
  const saved = readback?.data;
  if (
    !readback || readback.error ||
    saved?.id !== decision.submissionId ||
    saved.acceptance_id !== decision.acceptanceId ||
    saved.status !== (approved ? "approved" : "rejected") ||
    saved.reviewed_at !== data.reviewed_at ||
    saved.reviewer_user_id !== data.reviewed_by_user_id ||
    saved.reject_reason !== reason
  ) {
    throw new TaskReviewDecisionUnconfirmedError();
  }
  return saved;
}
