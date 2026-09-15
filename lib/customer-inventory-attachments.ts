import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import {
  removeStorageObjectsVerified,
  requireRegisteredStorageRows,
  requireStorageUploadReceipt,
} from "./storage-operation-receipts";
import type { CustomerInventoryAttachment } from "./customer-inventory-types";
import { getFileExtension, sanitizeStorageFileName } from "./value-normalizers";

export const CUSTOMER_INVENTORY_ORDER_LIST_BUCKET =
  "customer-inventory-order-lists";
export const CUSTOMER_INVENTORY_MAX_FILES = 10;
export const CUSTOMER_INVENTORY_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const CUSTOMER_INVENTORY_MAX_TOTAL_SIZE_BYTES = 100 * 1024 * 1024;

const SIGNED_DOWNLOAD_SECONDS = 60;
const ALLOWED_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);
const MIME_TYPE_BY_EXTENSION = {
  csv: "text/csv",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

/**
 * 浏览器先给出容易理解的文件提示，数据库仍会独立检查数量、格式和大小。
 * 这样即使有人绕过页面直接调用接口，也不能突破附件限制。
 */
export function validateCustomerInventoryFiles({
  existingAttachments,
  files,
}: {
  existingAttachments: CustomerInventoryAttachment[];
  files: File[];
}) {
  if (files.length < 1) {
    throw new Error("请先选择要上传的 Order List 表格。");
  }

  if (
    existingAttachments.length + files.length >
    CUSTOMER_INVENTORY_MAX_FILES
  ) {
    throw new Error("每笔订单最多保存 10 个 Order List 附件。");
  }

  let totalSize = existingAttachments.reduce(
    (sum, attachment) => sum + Number(attachment.file_size_bytes),
    0,
  );

  files.forEach((file) => {
    const extension = getFileExtension(file.name);

    if (!extension || !ALLOWED_EXTENSIONS.has(extension)) {
      throw new Error("Order List 仅支持 CSV、XLS 和 XLSX 表格。");
    }

    if (file.size <= 0) {
      throw new Error(`“${file.name}”是空文件，请重新选择。`);
    }

    if (file.size > CUSTOMER_INVENTORY_MAX_FILE_SIZE_BYTES) {
      throw new Error(`“${file.name}”超过 20 MB，请压缩或拆分后再上传。`);
    }

    totalSize += file.size;
  });

  if (totalSize > CUSTOMER_INVENTORY_MAX_TOTAL_SIZE_BYTES) {
    throw new Error("这笔订单的 Order List 附件合计不能超过 100 MB。");
  }
}

export async function uploadCustomerInventoryFiles(
  supabase: SupabaseClient,
  options: {
    existingAttachments: CustomerInventoryAttachment[];
    files: File[];
    orderId: string;
    uploadedByUserId: string;
  },
) {
  validateCustomerInventoryFiles(options);

  const uploadedPaths: string[] = [];

  try {
    const metadataRows = [];

    for (const [index, file] of options.files.entries()) {
      const extension = getRequiredExtension(file.name);
      const storagePath = buildStoragePath({
        extension,
        fileName: file.name,
        index,
        orderId: options.orderId,
        uploadedByUserId: options.uploadedByUserId,
      });
      const mimeType = MIME_TYPE_BY_EXTENSION[extension];
      const { data: uploadReceipt, error } = await withRequestTimeout(
        supabase.storage
          .from(CUSTOMER_INVENTORY_ORDER_LIST_BUCKET)
          .upload(storagePath, file, {
            contentType: mimeType,
            upsert: false,
          }),
        {
          message: "Order List 上传时间有些长，请稍后重试。",
          timeoutMs: 60_000,
        },
      );

      if (error) throw error;
      requireStorageUploadReceipt(
        uploadReceipt,
        storagePath,
        "Order List 没有确认上传成功，请稍后重试。",
      );

      uploadedPaths.push(storagePath);
      metadataRows.push({
        file_size_bytes: file.size,
        mime_type: mimeType,
        original_name: file.name,
        storage_path: storagePath,
      });
    }

    const { data, error } = await withRequestTimeout(
      supabase.rpc("register_customer_inventory_order_list_attachments", {
        p_attachments: metadataRows,
        p_order_id: options.orderId,
      }),
    );

    if (error) throw error;

    return requireRegisteredStorageRows<CustomerInventoryAttachment>(data, {
      errorMessage: "Order List 没有全部登记成功，请稍后重试。",
      expectedParentId: options.orderId,
      expectedPaths: uploadedPaths,
      parentField: "order_id",
      pathField: "storage_path",
    });
  } catch (error) {
    // 元数据登记失败时清理刚上传的对象，避免私有存储留下无法从页面访问的孤立文件。
    if (uploadedPaths.length > 0) {
      await removeStorageObjectsVerified(
        supabase,
        CUSTOMER_INVENTORY_ORDER_LIST_BUCKET,
        uploadedPaths,
        {
          confirmationMessage: "失败文件没有全部清理，请联系管理员核对。",
          timeoutMessage: "失败文件清理超时，请联系管理员核对。",
        },
      );
    }

    throw error;
  }
}

export async function deleteCustomerInventoryAttachment(
  supabase: SupabaseClient,
  attachment: CustomerInventoryAttachment,
) {
  await removeStorageObjectsVerified(
    supabase,
    attachment.bucket_name || CUSTOMER_INVENTORY_ORDER_LIST_BUCKET,
    [attachment.storage_path],
    {
      confirmationMessage: "附件文件没有确认删除，请刷新后重试。",
      timeoutMessage: "附件删除超时，请稍后重试。",
    },
  );

  const { data: deletedAttachment, error: metadataError } = await withRequestTimeout(
    supabase.rpc("delete_customer_inventory_order_list_attachment", {
      p_attachment_id: attachment.id,
    }),
  );

  if (metadataError) throw metadataError;
  if (
    typeof deletedAttachment !== "object"
    || deletedAttachment === null
    || !("id" in deletedAttachment)
    || deletedAttachment.id !== attachment.id
  ) {
    throw new Error("附件记录没有删除成功，请刷新后重试。");
  }
}

export async function createCustomerInventoryAttachmentDownloadUrl(
  supabase: SupabaseClient,
  attachment: CustomerInventoryAttachment,
) {
  const { data, error } = await withRequestTimeout(
    supabase.storage
      .from(attachment.bucket_name || CUSTOMER_INVENTORY_ORDER_LIST_BUCKET)
      .createSignedUrl(attachment.storage_path, SIGNED_DOWNLOAD_SECONDS, {
        download: attachment.original_name,
      }),
  );

  if (error || !data?.signedUrl) {
    throw error ?? new Error("附件暂时无法下载，请稍后重试。");
  }

  return data.signedUrl;
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
