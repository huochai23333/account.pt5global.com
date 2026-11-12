import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  decideTaskReview,
  TaskReviewDecisionUnconfirmedError,
} from "../../lib/task-review-decisions";

const target = { acceptanceId: "acceptance", submissionId: "round-two" };
const reviewTime = "2026-11-06T05:00:00.000Z";
const acceptance = {
  id: target.acceptanceId,
  current_submission_id: target.submissionId,
  status: "completed",
  reviewed_at: reviewTime,
  reviewed_by_user_id: "administrator",
  review_reject_reason: null as string | null,
};
const submission = {
  id: target.submissionId,
  acceptance_id: target.acceptanceId,
  status: "approved",
  reviewed_at: reviewTime,
  reviewer_user_id: "administrator",
  reject_reason: null as string | null,
};

function reviewClient({
  receipt = acceptance,
  saved = submission,
  error = null,
}: {
  receipt?: typeof acceptance | null;
  saved?: typeof submission | null;
  error?: Error | null;
} = {}) {
  const calls: unknown[] = [];
  // 两个独立调用分别模拟写入回执与数据库读回，允许精确注入错轮次。
  const client = {
    rpc(name: string, params: unknown) {
      calls.push([name, params]);
      return { single: async () => ({ data: receipt, error }) };
    },
    from(table: string) {
      return {
        select: () => ({
          eq: (column: string, id: string) => ({
            maybeSingle: async () => {
              calls.push([table, column, id]);
              return { data: saved, error: null };
            },
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
  return { client, calls };
}

test("审核通过的请求和读回都绑定页面所见轮次", async () => {
  const { client, calls } = reviewClient();
  await expect(decideTaskReview(client, { ...target, action: "approve" })).resolves.toEqual(submission);
  expect(calls).toEqual([
    ["approve_task_review", { p_acceptance_id: target.acceptanceId, p_submission_id: target.submissionId }],
    ["task_review_submissions", "id", target.submissionId],
  ]);
});

test("退回校验该轮状态、审核人和整理后的备注", async () => {
  const receipt = { ...acceptance, status: "rejected", review_reject_reason: "Add a photo" };
  const saved = { ...submission, status: "rejected", reject_reason: "Add a photo" };
  const { client, calls } = reviewClient({ receipt, saved });
  await expect(decideTaskReview(client, { ...target, action: "reject", reason: " Add a photo " })).resolves.toEqual(saved);
  expect(calls[0]).toEqual([
    "reject_task_review",
    { p_acceptance_id: target.acceptanceId, p_submission_id: target.submissionId, p_reason: "Add a photo" },
  ]);
});

test("零影响、错轮次和未读到业务终态均无法确认成功", async () => {
  for (const fixture of [
    reviewClient({ receipt: null }),
    reviewClient({ receipt: { ...acceptance, current_submission_id: "round-one" } }),
    reviewClient({ saved: null }),
    reviewClient({ saved: { ...submission, reviewer_user_id: "different-user" } }),
  ]) {
    await expect(decideTaskReview(fixture.client, { ...target, action: "approve" }))
      .rejects.toBeInstanceOf(TaskReviewDecisionUnconfirmedError);
  }
});

test("过期卡片的数据库拒绝继续传给页面", async () => {
  const error = new Error("task review submission changed");
  const { client, calls } = reviewClient({ error });
  await expect(decideTaskReview(client, { ...target, action: "approve" })).rejects.toBe(error);
  expect(calls).toHaveLength(1);
});
