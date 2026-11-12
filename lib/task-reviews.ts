import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeTaskScope } from "./admin-task-normalizers";
import { withRequestTimeout } from "./request-timeout";
import { getTaskReviewSubmissionAssets } from "./task-review-assets";
import type { TaskReviewSubmissionAsset } from "./task-review-assets";
import {
  normalizeInteger,
  normalizeNumericValue,
  normalizeOptionalString,
} from "./value-normalizers";

const PENDING_TASK_REVIEW_SELECT =
  "acceptance_id,task_id,task_name,task_intro,task_type_code,task_type_name,commission_amount_rmb,scope,team_id,team_name,accepted_by_user_id,accepted_by_name,accepted_by_email,submission_id,submission_round,submission_note,submitted_at,asset_count";

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

// 读取管理员可见的待审记录，再按提交编号组装附件。
export async function getPendingTaskReviews(supabase: SupabaseClient) {
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

function normalizePendingTaskReviewRecord(value: unknown): PendingTaskReviewRow | null {
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
    "accepted_by_user_id" in value ? normalizeOptionalString(value.accepted_by_user_id) : null;
  const submissionId =
    "submission_id" in value ? normalizeOptionalString(value.submission_id) : null;
  const submissionRound =
    "submission_round" in value ? normalizeInteger(value.submission_round) : null;
  const scope = "scope" in value ? normalizeTaskScope(value.scope) : null;

  if (
    !acceptanceId ||
    !taskId ||
    !taskName ||
    !taskTypeCode ||
    !acceptedByUserId ||
    !submissionId ||
    !submissionRound ||
    !scope
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
        ? (normalizeNumericValue(value.commission_amount_rmb) ?? 0)
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
