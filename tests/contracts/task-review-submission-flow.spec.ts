import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import {
  finalizeTaskReviewSubmission,
  TaskReviewSubmissionUnconfirmedError,
} from "../../lib/task-review-submission-flow";

const submission = {
  acceptanceId: "acceptance",
  submissionId: "submission",
  viewerId: "salesman",
  assets: [{
    bucket_name: "task-review-submissions",
    task_attachment_storage_path: "salesman/submission/photo.png",
  }],
};

const committed = {
  id: submission.submissionId,
  acceptance_id: submission.acceptanceId,
  submitted_by_user_id: submission.viewerId,
  status: "pending",
  submitted_at: "2026-11-06T00:00:00Z",
};

function clientFixture({
  reads,
  submitError = new Error("response lost"),
  cancellationError = null,
  removalEffective = true,
}: {
  reads: (typeof committed | null | Error)[];
  submitError?: Error | null;
  cancellationError?: Error | null;
  removalEffective?: boolean;
}) {
  const calls: string[] = [];
  let fileExists = true;

  // 只模拟网络边界，运行真实读回、草稿取消和 Storage 删除确认代码。
  const client = {
    async rpc(name: string, input: Record<string, string>) {
      calls.push(name);
      if (name === "submit_task_review") {
        expect(input).toEqual({ p_acceptance_id: submission.acceptanceId, p_submission_id: submission.submissionId });
        return { error: submitError, data: null };
      }
      expect(name).toBe("cancel_task_review_submission");
      expect(input).toEqual({ p_submission_id: submission.submissionId });
      return { error: cancellationError, data: null };
    },
    from(table: string) {
      expect(table).toBe("task_review_submissions");
      return {
        select(columns: string) {
          return {
            eq(column: string, id: string) {
              expect([column, id]).toEqual(["id", submission.submissionId]);
              return {
                async maybeSingle() {
                  calls.push(columns === "id" ? "confirm-cancel" : "read-submission");
                  const response = reads.shift();
                  return response instanceof Error ? { error: response } : { data: response, error: null };
                },
              };
            },
          };
        },
      };
    },
    storage: {
      from(bucket: string) {
        expect(bucket).toBe(submission.assets[0].bucket_name);
        return {
          async exists(path: string) {
            expect(path).toBe(submission.assets[0].task_attachment_storage_path);
            calls.push("check-file");
            return { data: fileExists, error: null };
          },
          async remove(paths: string[]) {
            expect(paths).toEqual([submission.assets[0].task_attachment_storage_path]);
            calls.push("remove-file");
            fileExists = !removalEffective;
            return { data: [], error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;

  return { client, calls, fileExists: () => fileExists };
}

test("已提交但响应丢失时以原提交记录确认，保留附件", async () => {
  const fixture = clientFixture({ reads: [committed] });
  await finalizeTaskReviewSubmission(fixture.client, submission);
  expect(fixture.calls).toEqual(["submit_task_review", "read-submission"]);
  expect(fixture.fileExists()).toBe(true);
});

test("取消与提审交错时，读回已处理记录并保留文件", async () => {
  const fixture = clientFixture({
    reads: [{ ...committed, status: "draft", submitted_at: "" }, { ...committed, status: "approved" }],
    cancellationError: new Error("task review submission is not draft"),
  });
  await finalizeTaskReviewSubmission(fixture.client, submission);
  expect(fixture.calls).toEqual(["submit_task_review", "read-submission", "cancel_task_review_submission", "read-submission"]);
  expect(fixture.fileExists()).toBe(true);
});

test("只有确认取消草稿后才会清理对象，并返回原提交错误", async () => {
  const submitError = new Error("task review submission assets are required");
  const fixture = clientFixture({ reads: [null, null], submitError });
  await expect(finalizeTaskReviewSubmission(fixture.client, submission)).rejects.toBe(submitError);
  expect(fixture.calls).toEqual(["submit_task_review", "read-submission", "cancel_task_review_submission", "confirm-cancel", "check-file", "remove-file", "check-file"]);
  expect(fixture.fileExists()).toBe(false);
});

test("成功响应也必须读到正确记录，取消未确认时保留附件", async () => {
  const otherAcceptance = { ...committed, acceptance_id: "other" };
  const fixture = clientFixture({ reads: [otherAcceptance, { ...committed, status: "draft" }, new Error("read unavailable")], submitError: null });
  await expect(finalizeTaskReviewSubmission(fixture.client, submission)).rejects.toBeInstanceOf(TaskReviewSubmissionUnconfirmedError);
  expect(fixture.calls).not.toContain("remove-file");
  expect(fixture.fileExists()).toBe(true);
});

test("草稿已取消但删除零影响时返回部分失败", async () => {
  const fixture = clientFixture({ reads: [null, null], removalEffective: false });
  await expect(finalizeTaskReviewSubmission(fixture.client, submission)).rejects.toMatchObject({ status: "partial_failed" });
  expect(fixture.calls.at(-1)).toBe("check-file");
  expect(fixture.fileExists()).toBe(true);
});
