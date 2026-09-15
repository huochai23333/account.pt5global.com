import type { SupabaseClient } from "@supabase/supabase-js";

import { removeStorageObjectsVerified } from "./storage-operation-receipts";
import { exceedsUploadFileSizeLimit } from "./upload-file-size-limits";
import {
  getFileExtension,
  normalizeOptionalString,
  sanitizeStorageFileName,
} from "./value-normalizers";

export const TASK_ATTACHMENT_MAX_FILES = 10;
export const TASK_ATTACHMENT_MAX_TOTAL_SIZE_BYTES = 100 * 1024 * 1024;

const TASK_ATTACHMENT_ALLOWED_MIME_PREFIXES = [
  "image/",
  "video/",
  "audio/",
  "text/",
];
const TASK_ATTACHMENT_ALLOWED_MIME_TYPES = new Set([
  "application/json",
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.rar",
  "application/x-7z-compressed",
  "application/x-rar-compressed",
  "application/x-zip-compressed",
  "application/zip",
]);
const TASK_ATTACHMENT_ALLOWED_EXTENSIONS = new Set([
  "7z",
  "avi",
  "csv",
  "doc",
  "docx",
  "gif",
  "jpeg",
  "jpg",
  "json",
  "m4a",
  "mkv",
  "mov",
  "mp3",
  "mp4",
  "pdf",
  "png",
  "ppt",
  "pptx",
  "rar",
  "txt",
  "wav",
  "webm",
  "webp",
  "xls",
  "xlsx",
  "zip",
]);

type TaskAttachmentValidationErrorCodes = {
  countExceeded: string;
  empty: string;
  required?: string;
  tooLarge: string;
  totalTooLarge: string;
  typeNotAllowed: string;
};

type TaskAttachmentValidationOptions = {
  errorCodes: TaskAttachmentValidationErrorCodes;
  files: File[];
  requireFiles?: boolean;
};

export function validateTaskAttachmentFiles({
  errorCodes,
  files,
  requireFiles = false,
}: TaskAttachmentValidationOptions) {
  if (requireFiles && files.length === 0) {
    throw new Error(errorCodes.required ?? errorCodes.empty);
  }

  if (files.length > TASK_ATTACHMENT_MAX_FILES) {
    throw new Error(errorCodes.countExceeded);
  }

  let totalSizeBytes = 0;

  for (const file of files) {
    totalSizeBytes += file.size;

    if (file.size <= 0) {
      throw new Error(errorCodes.empty);
    }

    if (exceedsUploadFileSizeLimit(file)) {
      throw new Error(errorCodes.tooLarge);
    }

    if (!isAllowedTaskAttachmentFile(file)) {
      throw new Error(errorCodes.typeNotAllowed);
    }
  }

  if (totalSizeBytes > TASK_ATTACHMENT_MAX_TOTAL_SIZE_BYTES) {
    throw new Error(errorCodes.totalTooLarge);
  }
}

export function buildTaskAttachmentStoragePath({
  fallbackPrefix,
  fileName,
  index,
  ownerId,
  parentId,
}: {
  fallbackPrefix: string;
  fileName: string;
  index: number;
  ownerId: string;
  parentId: string;
}) {
  const safeName = sanitizeStorageFileName(fileName) || `${fallbackPrefix}-${index + 1}`;
  const uniqueKey =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${index + 1}`;

  return `${ownerId}/${parentId}/${uniqueKey}-${safeName}`;
}

export async function removeTaskStorageObjects(
  supabase: SupabaseClient,
  objects: Array<{
    bucket_name: string | null;
    task_attachment_storage_path: string | null;
  }>,
  options: {
    defaultBucket: string;
    timeoutMessage: string;
  },
) {
  if (objects.length === 0) {
    return;
  }

  const pathsByBucket = new Map<string, string[]>();

  objects.forEach((object) => {
    const bucketName = normalizeOptionalString(object.bucket_name) ?? options.defaultBucket;
    const storagePath = normalizeOptionalString(object.task_attachment_storage_path);

    if (!storagePath) {
      return;
    }

    const paths = pathsByBucket.get(bucketName);

    if (paths) {
      paths.push(storagePath);
      return;
    }

    pathsByBucket.set(bucketName, [storagePath]);
  });

  for (const [bucketName, storagePaths] of pathsByBucket.entries()) {
    if (storagePaths.length === 0) {
      continue;
    }

    await removeStorageObjectsVerified(supabase, bucketName, storagePaths, {
      confirmationMessage: "附件没有确认删除，请刷新后核对。",
      timeoutMessage: options.timeoutMessage,
    });
  }
}

function isAllowedTaskAttachmentFile(file: File) {
  const normalizedType = file.type.trim().toLowerCase();

  if (normalizedType) {
    if (
      TASK_ATTACHMENT_ALLOWED_MIME_PREFIXES.some((prefix) =>
        normalizedType.startsWith(prefix),
      )
    ) {
      return true;
    }

    if (TASK_ATTACHMENT_ALLOWED_MIME_TYPES.has(normalizedType)) {
      return true;
    }
  }

  const extension = getFileExtension(file.name);
  return extension ? TASK_ATTACHMENT_ALLOWED_EXTENSIONS.has(extension) : false;
}
