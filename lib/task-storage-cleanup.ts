import type { SupabaseClient } from "@supabase/supabase-js";

import { removeStoredTaskAttachments } from "./admin-task-attachments";
import { withRequestTimeout } from "./request-timeout";
import {
  getTaskReviewSubmissionAssetsForTask,
  removeStoredTaskReviewSubmissionAssets,
} from "./task-review-assets";
import { normalizeOptionalString } from "./value-normalizers";

const TASK_ATTACHMENT_BUCKET = "task-attachments";

type TaskStorageAsset = {
  bucket_name: string | null;
  task_attachment_storage_path: string | null;
};

export async function prepareDeletedTaskStorageCleanup(
  supabase: SupabaseClient,
  options: {
    taskId: string;
    taskAttachments: TaskStorageAsset[];
  },
) {
  const [taskAttachments, reviewSubmissionAssets] = await Promise.all([
    getTaskAttachmentsForDeletion(supabase, options.taskId, options.taskAttachments),
    getTaskReviewSubmissionAssetsForTask(supabase, options.taskId),
  ]);

  return async function runDeletedTaskStorageCleanup() {
    // 两种文件独立清理，某组失败不能掩盖另一组的结果。
    const [taskFiles, reviewFiles] = await Promise.allSettled([
      removeStoredTaskAttachments(supabase, taskAttachments),
      removeStoredTaskReviewSubmissionAssets(supabase, dedupeStorageAssets(reviewSubmissionAssets)),
    ]);

    const unconfirmedGroups: Array<"task_attachments" | "review_attachments"> = [];
    if (taskFiles.status === "rejected") unconfirmedGroups.push("task_attachments");
    if (reviewFiles.status === "rejected") unconfirmedGroups.push("review_attachments");
    return unconfirmedGroups;
  };
}

async function getTaskAttachmentsForDeletion(
  supabase: SupabaseClient,
  taskId: string,
  fallbackAttachments: TaskStorageAsset[],
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("task_sub")
      .select("bucket_name,task_attachment_storage_path")
      .eq("task_id", taskId)
      .returns<TaskStorageAsset[]>(),
  );

  if (error) {
    throw error;
  }

  return dedupeStorageAssets([...(data ?? []), ...fallbackAttachments]);
}

function dedupeStorageAssets<T extends TaskStorageAsset>(assets: T[]) {
  const seenKeys = new Set<string>();

  return assets.filter((asset) => {
    const bucketName = normalizeOptionalString(asset.bucket_name);
    const storagePath = normalizeOptionalString(asset.task_attachment_storage_path);

    if (!storagePath) {
      return false;
    }

    const key = `${bucketName ?? TASK_ATTACHMENT_BUCKET}:${storagePath}`;

    if (seenKeys.has(key)) {
      return false;
    }

    seenKeys.add(key);
    return true;
  });
}
