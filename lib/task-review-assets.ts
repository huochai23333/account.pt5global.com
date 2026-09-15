import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import {
  buildTaskAttachmentStoragePath,
  removeTaskStorageObjects,
  TASK_ATTACHMENT_MAX_FILES,
  TASK_ATTACHMENT_MAX_TOTAL_SIZE_BYTES,
  validateTaskAttachmentFiles,
} from "./task-attachment-policy";
import {
  normalizeInteger,
  normalizeOptionalString,
} from "./value-normalizers";

const TASK_REVIEW_BUCKET = "task-review-submissions";
const TASK_REVIEW_ASSET_SELECT =
  "id,submission_id,task_attachment_storage_path,file_size_bytes,original_name,bucket_name,mime_type,uploaded_by_user_id,created_at";

export const TASK_REVIEW_SUBMISSION_MAX_FILES = TASK_ATTACHMENT_MAX_FILES;
export const TASK_REVIEW_SUBMISSION_MAX_TOTAL_SIZE_BYTES =
  TASK_ATTACHMENT_MAX_TOTAL_SIZE_BYTES;

export type TaskReviewSubmissionAsset = {
  id: string;
  submission_id: string;
  task_attachment_storage_path: string;
  file_size_bytes: number;
  original_name: string;
  bucket_name: string;
  mime_type: string;
  uploaded_by_user_id: string;
  created_at: string | null;
};

type TaskReviewSubmissionAssetRecord = {
  id: string | null;
  submission_id: string | null;
  task_attachment_storage_path: string | null;
  file_size_bytes: number | string | null;
  original_name: string | null;
  bucket_name: string | null;
  mime_type: string | null;
  uploaded_by_user_id: string | null;
  created_at: string | null;
};

type TaskReviewSubmissionIdRecord = {
  id: string | null;
};

export async function uploadTaskReviewSubmissionAssets(
  supabase: SupabaseClient,
  options: {
    submissionId: string;
    uploadedByUserId: string;
    files: File[];
    requireFiles?: boolean;
  },
) {
  validateTaskReviewSubmissionFiles(options.files, {
    requireFiles: options.requireFiles ?? true,
  });

  if (options.files.length === 0) {
    return [];
  }

  const uploadedObjects: Array<Pick<TaskReviewSubmissionAsset, "bucket_name" | "task_attachment_storage_path">> = [];

  try {
    for (const [index, file] of options.files.entries()) {
      const storagePath = buildTaskAttachmentStoragePath({
        fallbackPrefix: "submission",
        fileName: file.name,
        index,
        ownerId: options.uploadedByUserId,
        parentId: options.submissionId,
      });

      const { error } = await withRequestTimeout(
        supabase.storage.from(TASK_REVIEW_BUCKET).upload(storagePath, file, {
          contentType: file.type || undefined,
          upsert: false,
        }),
        {
          timeoutMs: 60_000,
          message: "任务审核附件上传超时，请稍后重试。",
        },
      );

      if (error) {
        throw error;
      }

      uploadedObjects.push({
        bucket_name: TASK_REVIEW_BUCKET,
        task_attachment_storage_path: storagePath,
      });
    }

    const metadataRows = options.files.map((file, index) => ({
      submission_id: options.submissionId,
      task_attachment_storage_path: uploadedObjects[index]?.task_attachment_storage_path ?? "",
      file_size_bytes: file.size,
      original_name: file.name,
      bucket_name: TASK_REVIEW_BUCKET,
      mime_type: file.type || "application/octet-stream",
      uploaded_by_user_id: options.uploadedByUserId,
    }));

    const { data, error } = await withRequestTimeout(
      supabase
        .from("task_review_submission_assets")
        .insert(metadataRows)
        .select(TASK_REVIEW_ASSET_SELECT)
        .returns<TaskReviewSubmissionAssetRecord[]>(),
    );

    if (error) {
      throw error;
    }

    if (!data || data.length !== metadataRows.length) {
      throw new Error("审核附件没有全部登记成功，请稍后重试。");
    }

    return normalizeTaskReviewSubmissionAssetRecords(data);
  } catch (error) {
    await removeStoredTaskReviewSubmissionAssets(supabase, uploadedObjects);
    throw error;
  }
}

export async function removeStoredTaskReviewSubmissionAssets(
  supabase: SupabaseClient,
  assets: Pick<TaskReviewSubmissionAsset, "bucket_name" | "task_attachment_storage_path">[],
) {
  await removeTaskStorageObjects(supabase, assets, {
    defaultBucket: TASK_REVIEW_BUCKET,
    timeoutMessage: "任务审核附件删除超时，请稍后重试。",
  });
}

export async function getTaskReviewSubmissionAssetsForTask(
  supabase: SupabaseClient,
  taskId: string,
) {
  const normalizedTaskId = normalizeOptionalString(taskId);

  if (!normalizedTaskId) {
    return [];
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("task_review_submissions")
      .select("id")
      .eq("task_id", normalizedTaskId)
      .returns<TaskReviewSubmissionIdRecord[]>(),
  );

  if (error) {
    throw error;
  }

  const submissionIds = Array.from(
    new Set(
      (data ?? [])
        .map((row) => normalizeOptionalString(row.id))
        .filter((submissionId): submissionId is string => submissionId !== null),
    ),
  );

  if (submissionIds.length === 0) {
    return [];
  }

  return getTaskReviewSubmissionAssets(supabase, submissionIds);
}

export async function getTaskReviewSubmissionAssetSignedUrl(
  supabase: SupabaseClient,
  asset: Pick<TaskReviewSubmissionAsset, "bucket_name" | "task_attachment_storage_path">,
  expiresIn = 60 * 10,
) {
  const { data, error } = await withRequestTimeout(
    supabase.storage
      .from(asset.bucket_name)
      .createSignedUrl(asset.task_attachment_storage_path, expiresIn),
  );

  if (error) {
    throw error;
  }

  return data.signedUrl;
}

export async function downloadTaskReviewSubmissionAssetBlob(
  supabase: SupabaseClient,
  asset: Pick<TaskReviewSubmissionAsset, "bucket_name" | "task_attachment_storage_path">,
) {
  const { data, error } = await withRequestTimeout(
    supabase.storage
      .from(asset.bucket_name)
      .download(asset.task_attachment_storage_path),
    {
      timeoutMs: 60_000,
      message: "task_review_submission_asset_download_timeout",
    },
  );

  if (error) {
    throw error;
  }

  return data;
}

export function validateTaskReviewSubmissionFiles(
  files: File[],
  options: {
    requireFiles?: boolean;
  } = {},
) {
  validateTaskAttachmentFiles({
    files,
    requireFiles: options.requireFiles ?? true,
    errorCodes: {
      countExceeded: "task_review_submission_attachments_count_exceeded",
      empty: "task_review_submission_attachment_empty",
      required: "task_review_submission_files_required",
      tooLarge: "task_review_submission_attachment_too_large",
      totalTooLarge: "task_review_submission_attachments_total_too_large",
      typeNotAllowed: "task_review_submission_attachment_type_not_allowed",
    },
  });
}

export async function getTaskReviewSubmissionAssets(
  supabase: SupabaseClient,
  submissionIds: string[],
) {
  const normalizedSubmissionIds = Array.from(
    new Set(submissionIds.map((id) => normalizeOptionalString(id)).filter(Boolean)),
  ) as string[];

  if (normalizedSubmissionIds.length === 0) {
    return [];
  }

  const { data, error } = await withRequestTimeout(
    supabase
      .from("task_review_submission_assets")
      .select(TASK_REVIEW_ASSET_SELECT)
      .in("submission_id", normalizedSubmissionIds)
      .order("created_at", { ascending: true })
      .returns<TaskReviewSubmissionAssetRecord[]>(),
  );

  if (error) {
    throw error;
  }

  return normalizeTaskReviewSubmissionAssetRecords(data ?? []);
}

function normalizeTaskReviewSubmissionAssetRecords(
  values: TaskReviewSubmissionAssetRecord[],
) {
  return values
    .map((item) => normalizeTaskReviewSubmissionAssetRecord(item))
    .filter((item): item is TaskReviewSubmissionAsset => item !== null);
}

function normalizeTaskReviewSubmissionAssetRecord(
  value: unknown,
): TaskReviewSubmissionAsset | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const id = "id" in value ? normalizeOptionalString(value.id) : null;
  const submissionId =
    "submission_id" in value ? normalizeOptionalString(value.submission_id) : null;
  const storagePath =
    "task_attachment_storage_path" in value
      ? normalizeOptionalString(value.task_attachment_storage_path)
      : null;
  const originalName =
    "original_name" in value ? normalizeOptionalString(value.original_name) : null;
  const bucketName = "bucket_name" in value ? normalizeOptionalString(value.bucket_name) : null;
  const mimeType = "mime_type" in value ? normalizeOptionalString(value.mime_type) : null;
  const uploadedByUserId =
    "uploaded_by_user_id" in value
      ? normalizeOptionalString(value.uploaded_by_user_id)
      : null;

  if (!id || !submissionId || !storagePath || !originalName || !bucketName || !mimeType) {
    return null;
  }

  return {
    id,
    submission_id: submissionId,
    task_attachment_storage_path: storagePath,
    file_size_bytes:
      "file_size_bytes" in value ? normalizeInteger(value.file_size_bytes) : 0,
    original_name: originalName,
    bucket_name: bucketName,
    mime_type: mimeType,
    uploaded_by_user_id: uploadedByUserId ?? "",
    created_at: "created_at" in value ? normalizeOptionalString(value.created_at) : null,
  };
}
