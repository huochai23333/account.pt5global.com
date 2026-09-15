import type { SupabaseClient } from "@supabase/supabase-js";

import { normalizeTaskAttachment } from "./admin-task-normalizers";
import type {
  AdminTaskAttachment,
  TaskAttachmentRecord,
} from "./admin-tasks-types";
import { withRequestTimeout } from "./request-timeout";
import {
  requireRegisteredStorageRows,
  requireStorageUploadReceipt,
} from "./storage-operation-receipts";
import {
  buildTaskAttachmentStoragePath,
  removeTaskStorageObjects,
  TASK_ATTACHMENT_MAX_FILES,
  TASK_ATTACHMENT_MAX_TOTAL_SIZE_BYTES,
  validateTaskAttachmentFiles,
} from "./task-attachment-policy";

const TASK_ATTACHMENT_BUCKET = "task-attachments";

export const ADMIN_TASK_ATTACHMENT_MAX_FILES = TASK_ATTACHMENT_MAX_FILES;
export const ADMIN_TASK_ATTACHMENT_MAX_TOTAL_SIZE_BYTES =
  TASK_ATTACHMENT_MAX_TOTAL_SIZE_BYTES;

export async function getTaskAttachmentsByTaskIds(
  supabase: SupabaseClient,
  taskIds: string[],
): Promise<AdminTaskAttachment[]> {
  if (taskIds.length === 0) {
    return [];
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("task_sub")
      .select(
        "id,task_id,task_attachment_storage_path,file_size_bytes,original_name,bucket_name,mime_type,uploaded_by_user_id,created_at",
      )
      .in("task_id", taskIds)
      .order("created_at", { ascending: true })
      .returns<TaskAttachmentRecord[]>(),
  );

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((item) => normalizeTaskAttachment(item))
    .filter((item): item is AdminTaskAttachment => item !== null);
}

export async function uploadAdminTaskAttachments(
  supabase: SupabaseClient,
  options: {
    taskId: string;
    uploadedByUserId: string;
    files: File[];
  },
): Promise<AdminTaskAttachment[]> {
  if (options.files.length === 0) {
    return [];
  }

  validateAdminTaskAttachments(options.files);

  const uploadedObjects: Array<{
    bucket_name: string;
    task_attachment_storage_path: string;
  }> = [];

  try {
    for (const [index, file] of options.files.entries()) {
      const storagePath = buildTaskAttachmentStoragePath({
        fallbackPrefix: "attachment",
        fileName: file.name,
        index,
        ownerId: options.uploadedByUserId,
        parentId: options.taskId,
      });

      const { data: uploadReceipt, error } = await withRequestTimeout(
        supabase.storage.from(TASK_ATTACHMENT_BUCKET).upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        }),
        {
          timeoutMs: 60_000,
          message: "任务附件上传超时，请稍后重试。",
        },
      );

      if (error) {
        throw error;
      }
      requireStorageUploadReceipt(
        uploadReceipt,
        storagePath,
        "任务附件没有确认上传成功，请稍后重试。",
      );

      uploadedObjects.push({
        bucket_name: TASK_ATTACHMENT_BUCKET,
        task_attachment_storage_path: storagePath,
      });
    }

    const metadataRows = options.files.map((file, index) => ({
      task_id: options.taskId,
      task_attachment_storage_path: uploadedObjects[index]?.task_attachment_storage_path ?? "",
      file_size_bytes: file.size,
      original_name: file.name,
      bucket_name: TASK_ATTACHMENT_BUCKET,
      mime_type: file.type || "application/octet-stream",
      uploaded_by_user_id: options.uploadedByUserId,
    }));

    const { data, error } = await withRequestTimeout(
      supabase
        .from("task_sub")
        .insert(metadataRows)
        .select(
          "id,task_id,task_attachment_storage_path,file_size_bytes,original_name,bucket_name,mime_type,uploaded_by_user_id,created_at",
        )
        .returns<TaskAttachmentRecord[]>(),
    );

    if (error) {
      throw error;
    }

    const registeredRows = requireRegisteredStorageRows<TaskAttachmentRecord>(
      data,
      {
        errorMessage: "任务附件没有全部登记成功，请稍后重试。",
        expectedParentId: options.taskId,
        expectedPaths: uploadedObjects.map(
          (item) => item.task_attachment_storage_path,
        ),
        parentField: "task_id",
        pathField: "task_attachment_storage_path",
      },
    );

    const normalizedRows = registeredRows
      .map((item) => normalizeTaskAttachment(item))
      .filter((item): item is AdminTaskAttachment => item !== null);

    if (normalizedRows.length !== registeredRows.length) {
      throw new Error("任务附件返回的信息不完整，请刷新后核对。");
    }

    return normalizedRows;
  } catch (error) {
    await removeStoredTaskAttachments(
      supabase,
      uploadedObjects.map((item) => ({
        bucket_name: item.bucket_name,
        task_attachment_storage_path: item.task_attachment_storage_path,
      })),
    );

    throw error;
  }
}

export function validateAdminTaskAttachments(files: File[]) {
  validateTaskAttachmentFiles({
    files,
    errorCodes: {
      countExceeded: "admin_task_attachments_count_exceeded",
      empty: "admin_task_attachment_empty",
      tooLarge: "admin_task_attachment_too_large",
      totalTooLarge: "admin_task_attachments_total_too_large",
      typeNotAllowed: "admin_task_attachment_type_not_allowed",
    },
  });
}

async function removeStoredTaskAttachments(
  supabase: SupabaseClient,
  attachments: Pick<AdminTaskAttachment, "bucket_name" | "task_attachment_storage_path">[],
) {
  await removeTaskStorageObjects(supabase, attachments, {
    defaultBucket: TASK_ATTACHMENT_BUCKET,
    timeoutMessage: "任务附件删除超时，请稍后重试。",
  });
}
