import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import { getFileExtension, sanitizeStorageFileName } from "./value-normalizers";

export const WHOLESALE_ORDER_LIST_BUCKET = "wholesale-order-lists";
export const WHOLESALE_ORDER_LIST_MAX_FILES = 10;
export const WHOLESALE_ORDER_LIST_MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
export const WHOLESALE_ORDER_LIST_MAX_TOTAL_SIZE_BYTES = 100 * 1024 * 1024;

const SIGNED_DOWNLOAD_SECONDS = 60;
const ALLOWED_EXTENSIONS = new Set(["csv", "xls", "xlsx"]);

const MIME_TYPE_BY_EXTENSION = {
  csv: "text/csv",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
} as const;

export type WholesaleOrderListAttachment = {
  id: string;
  order_id: string;
  bucket_name: string;
  storage_path: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  uploaded_by_user_id: string;
  created_at: string;
};

/**
 * 上传前同时检查已有附件和本次选择的文件。
 * 浏览器校验用于尽早给出易懂提示，数据库触发器仍会再次执行同样的上限保护。
 */
export function validateWholesaleOrderListFiles({
  existingAttachments,
  files,
}: {
  existingAttachments: WholesaleOrderListAttachment[];
  files: File[];
}) {
  if (files.length === 0) {
    throw new Error("请先选择要上传的 Order List 表格。");
  }

  if (existingAttachments.length + files.length > WHOLESALE_ORDER_LIST_MAX_FILES) {
    throw new Error(`每笔订单最多保存 ${WHOLESALE_ORDER_LIST_MAX_FILES} 个 Order List 附件。`);
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
  validateWholesaleOrderListFiles(options);

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
      const { error } = await withRequestTimeout(
        supabase.storage
          .from(WHOLESALE_ORDER_LIST_BUCKET)
          .upload(storagePath, file, {
            contentType: mimeType,
            upsert: false,
          }),
        {
          message: "Order List 上传时间有些长，请稍后重试。",
          timeoutMs: 60_000,
        },
      );

      if (error) {
        throw error;
      }

      uploadedPaths.push(storagePath);
      metadataRows.push({
        file_size_bytes: file.size,
        mime_type: mimeType,
        original_name: file.name,
        storage_path: storagePath,
      });
    }

    const { data, error } = await withRequestTimeout(
      supabase.rpc("register_wholesale_order_list_attachments", {
        p_attachments: metadataRows,
        p_order_id: options.orderId,
      }),
    );

    if (error) {
      throw error;
    }

    return (data ?? []) as WholesaleOrderListAttachment[];
  } catch (error) {
    // 元数据登记失败时移除本次已经上传的对象，避免 bucket 中留下无人可见的孤立文件。
    if (uploadedPaths.length > 0) {
      await supabase.storage
        .from(WHOLESALE_ORDER_LIST_BUCKET)
        .remove(uploadedPaths);
    }

    throw error;
  }
}

export async function deleteWholesaleOrderListAttachment(
  supabase: SupabaseClient,
  attachment: WholesaleOrderListAttachment,
) {
  const { error: storageError } = await withRequestTimeout(
    supabase.storage
      .from(attachment.bucket_name || WHOLESALE_ORDER_LIST_BUCKET)
      .remove([attachment.storage_path]),
  );

  if (storageError) {
    throw storageError;
  }

  const { data: deletedRows, error: metadataError } = await withRequestTimeout(
    supabase
      .from("wholesale_order_list_attachments")
      .delete()
      .eq("id", attachment.id)
      .select("id")
      .maybeSingle<{ id: string }>(),
  );

  if (metadataError) {
    throw metadataError;
  }
  if (!deletedRows || deletedRows.id !== attachment.id) {
    throw new Error("附件记录没有删除成功，请刷新后重试。");
  }
}

export async function createWholesaleOrderListDownloadUrl(
  supabase: SupabaseClient,
  attachment: WholesaleOrderListAttachment,
) {
  const { data, error } = await withRequestTimeout(
    supabase.storage
      .from(attachment.bucket_name || WHOLESALE_ORDER_LIST_BUCKET)
      .createSignedUrl(attachment.storage_path, SIGNED_DOWNLOAD_SECONDS, {
        download: attachment.original_name,
      }),
  );

  if (error || !data?.signedUrl) {
    throw error ?? new Error("附件暂时无法下载，请稍后重试。");
  }

  return data.signedUrl;
}

function getRequiredExtension(fileName: string): keyof typeof MIME_TYPE_BY_EXTENSION {
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
  const safeName = sanitizeStorageFileName(fileName) || `order-list-${index + 1}.${extension}`;
  const uniqueKey =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${index + 1}`;

  return `${orderId}/${uploadedByUserId}/${uniqueKey}-${safeName}`;
}
