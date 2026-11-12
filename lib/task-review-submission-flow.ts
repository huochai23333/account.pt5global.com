import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import {
  removeStoredTaskReviewSubmissionAssets,
  type TaskReviewSubmissionAsset,
} from "./task-review-assets";
import { cancelTaskReviewSubmissionDraft, submitTaskReview } from "./task-review-draft-mutations";

type ReviewSubmission = {
  acceptanceId: string;
  submissionId: string;
  viewerId: string;
  assets: Pick<TaskReviewSubmissionAsset, "bucket_name" | "task_attachment_storage_path">[];
};

type SubmissionReadback = {
  id: string;
  acceptance_id: string;
  submitted_by_user_id: string;
  status: string;
  submitted_at: string | null;
};

export class TaskReviewSubmissionUnconfirmedError extends Error {
  constructor() {
    super("Task review submission could not be confirmed");
  }
}

export class TaskReviewAttachmentCleanupError extends Error {
  readonly status = "partial_failed";

  constructor() {
    super("Task review draft was cancelled but attachment cleanup is incomplete");
  }
}

export async function finalizeTaskReviewSubmission(
  supabase: SupabaseClient,
  submission: ReviewSubmission,
) {
  let failure: unknown = new TaskReviewSubmissionUnconfirmedError();
  try {
    await submitTaskReview(supabase, submission);
  } catch (error) {
    failure = error;
  }

  if (await hasSubmittedReview(supabase, submission)) return;

  try {
    // 取消与提交由数据库锁住同一草稿。只有取消并读回后才能删除附件。
    await cancelTaskReviewSubmissionDraft(supabase, submission.submissionId);
  } catch {
    // 提交可能在第一次查询后落库，取消失败时再查一次准确编号。
    if (await hasSubmittedReview(supabase, submission)) return;
    throw new TaskReviewSubmissionUnconfirmedError();
  }

  try {
    await removeStoredTaskReviewSubmissionAssets(supabase, submission.assets);
  } catch {
    // 草稿已取消，但文件仍可能留在 Storage，作为部分失败报告。
    throw new TaskReviewAttachmentCleanupError();
  }
  throw failure;
}

async function hasSubmittedReview(
  supabase: SupabaseClient,
  submission: ReviewSubmission,
) {
  try {
    const { data, error } = await withRequestTimeout(
      supabase
        .from("task_review_submissions")
        .select("id,acceptance_id,submitted_by_user_id,status,submitted_at")
        .eq("id", submission.submissionId)
        .maybeSingle<SubmissionReadback>(),
    );
    // 审核人可能已经处理。只认这次提交的记录及提交时间。
    return !error &&
      data?.id === submission.submissionId &&
      data.acceptance_id === submission.acceptanceId &&
      data.submitted_by_user_id === submission.viewerId &&
      Boolean(data.submitted_at) &&
      (data.status === "pending" || data.status === "approved" || data.status === "rejected");
  } catch {
    return false;
  }
}
