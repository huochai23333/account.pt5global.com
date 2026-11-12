import type { SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

import { deleteAdminTask } from "../../lib/admin-task-deletion";

const task = { id: "task", attachments: [] };
const taskPath = "admin/task/brief.pdf";
const reviewPath = "staff/submission/report.pdf";

function deletionClient({
  receipt = { id: task.id },
  readback = null,
  deleteError = null,
  readError = null,
  keepReview = false,
}: {
  receipt?: { id: string } | null;
  readback?: { id: string } | null;
  deleteError?: Error | null;
  readError?: Error | null;
  keepReview?: boolean;
} = {}) {
  const events: string[] = [];
  const files = new Set([taskPath, reviewPath]);

  // 模拟三个独立边界：数据库删除响应、数据库读回、Storage 存在性。
  const client = {
    from(table: string) {
      return {
        select: () => ({
          eq: () => ({
            returns: async () => {
              events.push(`list:${table}`);
              if (table === "task_sub") {
                return { data: [{ bucket_name: "task-attachments", task_attachment_storage_path: taskPath }], error: null };
              }
              expect(table).toBe("task_review_submissions");
              return { data: [{ id: "submission" }], error: null };
            },
            maybeSingle: async () => {
              expect(table).toBe("task_main");
              events.push("readback");
              return { data: readback, error: readError };
            },
          }),
          in: () => ({
            order: () => ({
              returns: async () => {
                expect(table).toBe("task_review_submission_assets");
                events.push("list:task_review_submission_assets");
                return {
                  data: [{
                    id: "asset", submission_id: "submission",
                    bucket_name: "task-review-submissions", task_attachment_storage_path: reviewPath,
                    original_name: "report.pdf", mime_type: "application/pdf",
                  }],
                  error: null,
                };
              },
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            select: () => ({
              maybeSingle: async () => {
                expect(table).toBe("task_main");
                events.push("delete");
                return { data: receipt, error: deleteError };
              },
            }),
          }),
        }),
      };
    },
    storage: {
      from(bucket: string) {
        return {
          exists: async (path: string) => ({ data: files.has(path), error: null }),
          async remove(paths: string[]) {
            events.push(`remove:${bucket}`);
            for (const path of paths) if (!keepReview || path !== reviewPath) files.delete(path);
            return { data: [], error: null };
          },
        };
      },
    },
  } as unknown as SupabaseClient;
  return { client, events, files };
}

test("读回确认任务不存在后清理两组附件", async () => {
  const fixture = deletionClient();
  await expect(deleteAdminTask(fixture.client, task)).resolves.toEqual({ status: "deleted" });
  expect(fixture.events.indexOf("list:task_review_submission_assets")).toBeLessThan(fixture.events.indexOf("delete"));
  expect(fixture.events.indexOf("readback")).toBeLessThan(fixture.events.indexOf("remove:task-attachments"));
  expect(fixture.files.size).toBe(0);
});

test("任务仍在或读回失败时不得清理附件", async () => {
  for (const fixture of [
    deletionClient({ readback: { id: task.id } }),
    deletionClient({ readError: new Error("read interrupted") }),
  ]) {
    await expect(deleteAdminTask(fixture.client, task)).resolves.toEqual({
      status: "partial_failed", stage: "task_confirmation",
    });
    expect(fixture.events.some((event) => event.startsWith("remove:"))).toBe(false);
    expect([...fixture.files]).toEqual([taskPath, reviewPath]);
  }
});

test("零影响、错编号和删除请求失败时保留两组附件", async () => {
  for (const fixture of [
    deletionClient({ receipt: null }),
    deletionClient({ receipt: { id: "other-task" } }),
    deletionClient({ deleteError: new Error("delete response lost") }),
  ]) {
    await expect(deleteAdminTask(fixture.client, task)).rejects.toThrow();
    expect(fixture.events).not.toContain("readback");
    expect([...fixture.files]).toEqual([taskPath, reviewPath]);
  }
});

test("提审对象删除零影响时返回部分失败并保留分组凭证", async () => {
  const fixture = deletionClient({ keepReview: true });
  await expect(deleteAdminTask(fixture.client, task)).resolves.toEqual({
    status: "partial_failed", stage: "attachments", unconfirmedGroups: ["review_attachments"],
  });
  expect([...fixture.files]).toEqual([reviewPath]);
});
