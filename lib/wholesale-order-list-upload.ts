import type { SupabaseClient } from "@supabase/supabase-js";

import { removeStorageObjectsVerified } from "./storage-operation-receipts";
import { getFileExtension, sanitizeStorageFileName } from "./value-normalizers";
import {
  WHOLESALE_ORDER_LIST_BUCKET,
  type WholesaleOrderListAttachment,
} from "./wholesale-order-list-attachments";
import {
  confirmWholesaleOrderListUploads,
  registerWholesaleOrderListUploads,
} from "./wholesale-order-list-registration";
import {
  readWholesaleUploadPlan,
  saveWholesaleUploadPlan,
  clearWholesaleUploadPlan,
  wholesaleUploadFileHash,
  requireWholesaleUploadFiles,
  requireWholesaleUploadRegistration,
  matchesWholesaleUploadFiles,
  WholesaleOrderListUploadPending,
  type WholesaleUploadPlan,
  WHOLESALE_ORDER_LIST_MAX_FILES,
  WHOLESALE_ORDER_LIST_MAX_FILE_SIZE_BYTES,
  WHOLESALE_ORDER_LIST_MAX_TOTAL_SIZE_BYTES,
  WHOLESALE_ORDER_LIST_MIME_TYPES as MIME_TYPE_BY_EXTENSION,
} from "./wholesale-order-list-upload-journal";
import {
  uploadWholesalePlannedObject,
  requireWholesaleUploadedObject,
} from "./wholesale-order-list-upload-object";

export {
  WholesaleOrderListUploadPending,
  WHOLESALE_ORDER_LIST_MAX_FILES,
  WHOLESALE_ORDER_LIST_MAX_FILE_SIZE_BYTES,
  WHOLESALE_ORDER_LIST_MAX_TOTAL_SIZE_BYTES,
} from "./wholesale-order-list-upload-journal";

const ALLOWED_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);

/**
 * 上传前同时检查已有附件和本次选择的文件。
 * 浏览器校验用于尽早给出易懂提示，数据库触发器仍会再次执行同样的上限保护。
 */
function validateWholesaleOrderListFiles({
  existingAttachments,
  files,
}: {
  existingAttachments: WholesaleOrderListAttachment[];
  files: File[];
}) {
  if (files.length === 0) {
    throw new Error("请先选择要上传的 Order List 表格。");
  }

  if (
    existingAttachments.length + files.length >
    WHOLESALE_ORDER_LIST_MAX_FILES
  ) {
    throw new Error(
      `每笔订单最多保存 ${WHOLESALE_ORDER_LIST_MAX_FILES} 个 Order List 附件。`,
    );
  }

  const existingSize = existingAttachments.reduce(
    (total, attachment) => total + Number(attachment.file_size_bytes),
    0,
  );
  let newSize = 0;

  files.forEach((file) => {
    const extension = getFileExtension(file.name);

    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error("Order List 仅支持 CSV、XLS 和 XLSX 表格。");
    }

    if (file.size <= 0) {
      throw new Error(`“${file.name}”是空文件，请重新选择。`);
    }

    if (file.size > WHOLESALE_ORDER_LIST_MAX_FILE_SIZE_BYTES) {
      throw new Error(`“${file.name}”超过 20 MB，请压缩或拆分后再上传。`);
    }

    newSize += file.size;
  });

  if (existingSize + newSize > WHOLESALE_ORDER_LIST_MAX_TOTAL_SIZE_BYTES) {
    throw new Error("这笔订单的 Order List 附件合计不能超过 100 MB。");
  }
}

export async function uploadWholesaleOrderListFiles(
  supabase: SupabaseClient,
  options: {
    existingAttachments: WholesaleOrderListAttachment[];
    files: File[];
    orderId: string;
    uploadedByUserId: string;
  },
) {
  let prior: WholesaleUploadPlan | null;
  try {
    prior = readWholesaleUploadPlan(options.orderId, options.uploadedByUserId);
  } catch (cause) {
    throw new WholesaleOrderListUploadPending(cause);
  }
  const bucket = supabase.storage.from(WHOLESALE_ORDER_LIST_BUCKET);
  if (prior?.stage === "registering") {
    // 先结清上次不明结果。原文件重选是核对；不同文件只有在旧批次已确认后才作为新上传。
    const rows = await confirmWholesaleOrderListUploads(
      supabase,
      prior.orderId,
      prior.files.map((file) => file.storage_path),
    );
    requireWholesaleUploadRegistration(prior, rows);
    for (const file of prior.files)
      await requireWholesaleUploadedObject(bucket, file);
    const sameFiles = await matchesWholesaleUploadFiles(prior, options.files);
    clearWholesaleUploadPlan(prior.orderId, prior.userId);
    if (sameFiles) return rows;
    prior = null;
  }
  // 恢复时列表可能已经包含本批登记，不能把同一文件重复计入数量上限。
  validateWholesaleOrderListFiles({
    ...options,
    existingAttachments: options.existingAttachments.filter(
      (row) =>
        !prior?.files.some((file) => file.storage_path === row.storage_path),
    ),
  });
  const plan: WholesaleUploadPlan = prior ?? {
    orderId: options.orderId,
    userId: options.uploadedByUserId,
    stage: "uploading",
    files: await Promise.all(
      options.files.map(async (file, index) => {
        const extension = getRequiredExtension(file.name);
        return {
          file_size_bytes: file.size,
          mime_type: MIME_TYPE_BY_EXTENSION[extension],
          original_name: file.name,
          storage_path: buildStoragePath({
            extension,
            fileName: file.name,
            index,
            orderId: options.orderId,
            uploadedByUserId: options.uploadedByUserId,
          }),
          sha256: await wholesaleUploadFileHash(file),
        };
      }),
    ),
  };
  const uploadFiles = prior
    ? await requireWholesaleUploadFiles(plan, options.files)
    : options.files;
  try {
    saveWholesaleUploadPlan(plan);
  } catch (cause) {
    throw new WholesaleOrderListUploadPending(cause);
  }
  const confirmedPaths: string[] = [];
  try {
    for (const [index, file] of uploadFiles.entries()) {
      const planned = plan.files[index]!;
      await uploadWholesalePlannedObject(bucket, planned, file, Boolean(prior));
      confirmedPaths.push(planned.storage_path);
    }
  } catch (error) {
    if (error instanceof WholesaleOrderListUploadPending) throw error;
    // 未得到明确写入结果时保留整批范围，不能因一次空目录就清除核对记录。
    throw new WholesaleOrderListUploadPending(error);
  }
  plan.stage = "registering";
  try {
    saveWholesaleUploadPlan(plan);
  } catch (cause) {
    throw new WholesaleOrderListUploadPending(cause);
  }
  const uploads = plan.files.map((file) => ({
    storage_path: file.storage_path,
    original_name: file.original_name,
    file_size_bytes: file.file_size_bytes,
    mime_type: file.mime_type,
  }));
  const result = await registerWholesaleOrderListUploads(
    supabase,
    options.orderId,
    uploads,
  );
  if (result.kind === "rejected") {
    try {
      await cleanupUploadedPaths(supabase, confirmedPaths);
      clearWholesaleUploadPlan(plan.orderId, plan.userId);
    } catch (cause) {
      throw new WholesaleOrderListUploadPending(cause);
    }
    throw result.error;
  }
  requireWholesaleUploadRegistration(plan, result.rows);
  // 登记后的最终核对覆盖写入期间的变化；缺少对象或正文不符时仍保留待核对记录。
  for (const file of plan.files)
    await requireWholesaleUploadedObject(bucket, file);
  clearWholesaleUploadPlan(plan.orderId, plan.userId);
  return result.rows;
}

function cleanupUploadedPaths(supabase: SupabaseClient, paths: string[]) {
  return removeStorageObjectsVerified(
    supabase,
    WHOLESALE_ORDER_LIST_BUCKET,
    paths,
    {
      confirmationMessage: "失败文件没有全部清理，请联系管理员核对。",
      timeoutMessage: "失败文件清理超时，请联系管理员核对。",
    },
  );
}

function getRequiredExtension(
  fileName: string,
): keyof typeof MIME_TYPE_BY_EXTENSION {
  const extension = getFileExtension(fileName);

  if (extension === "csv" || extension === "xls" || extension === "xlsx") {
    return extension;
  }

  throw new Error("Order List 仅支持 CSV、XLS 和 XLSX 表格。");
}

function buildStoragePath({
  extension,
  fileName,
  index,
  orderId,
  uploadedByUserId,
}: {
  extension: keyof typeof MIME_TYPE_BY_EXTENSION;
  fileName: string;
  index: number;
  orderId: string;
  uploadedByUserId: string;
}) {
  const safeName =
    sanitizeStorageFileName(fileName) || `order-list-${index + 1}.${extension}`;
  const uniqueKey =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${index + 1}`;

  return `${orderId}/${uploadedByUserId}/${uniqueKey}-${safeName}`;
}
