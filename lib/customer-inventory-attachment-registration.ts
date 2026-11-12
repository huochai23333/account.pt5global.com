import type { SupabaseClient } from "@supabase/supabase-js";

import type { CustomerInventoryAttachment } from "./customer-inventory-types";
import { withRequestTimeout } from "./request-timeout";
import { confirmStoragePathsPresent } from "./storage-operation-receipt-validation";
import { requireRegisteredStorageRows } from "./storage-operation-receipts";

export const CUSTOMER_INVENTORY_ORDER_LIST_BUCKET = "customer-inventory-order-lists";

type AttachmentUpload = Pick<CustomerInventoryAttachment,
  "file_size_bytes" | "mime_type" | "original_name" | "storage_path">;

const rejectionMessages = new Set([
  "customer_inventory_order_not_found",
  "customer_inventory_attachments_invalid",
  "customer_inventory_attachment_count_exceeded",
  "customer_inventory_attachment_total_size_exceeded",
]);
const unconfirmed = "附件登记结果还需要核对。";

export class InventoryAttachmentRegistrationPending extends Error {
  constructor(readonly orderId: string, readonly paths: string[], cause: unknown) {
    super(unconfirmed, { cause });
  }
}

export async function registerInventoryAttachments(
  supabase: SupabaseClient,
  orderId: string,
  uploads: AttachmentUpload[],
) {
  // verified-rpc: 即使返回登记行，也用当前订单和原路径重新读取登记与对象。
  const response = await withRequestTimeout(
    supabase.rpc("register_customer_inventory_order_list_attachments", {
      p_attachments: uploads,
      p_order_id: orderId,
    }),
  ).catch(() => null);
  const error = response?.error;
  // 只把明确的事务拒绝交给调用方清理。网络错误可能发生在事务提交之后。
  if (response && error && response.status >= 400 && response.status < 500 &&
    (/^(?:22[0-9A-Z]{3}|23[0-9A-Z]{3}|42501)$/.test(error.code) ||
      (error.code === "P0001" && rejectionMessages.has(error.message)))) {
    return { kind: "rejected" as const, error };
  }
  return {
    kind: "registered" as const,
    rows: await confirmInventoryAttachments(supabase, orderId, uploads.map((upload) => upload.storage_path)),
  };
}

export async function confirmInventoryAttachments(
  supabase: SupabaseClient,
  orderId: string,
  paths: string[],
) {
  try {
    const { data, error } = await withRequestTimeout(
      supabase.from("customer_inventory_order_list_attachments").select("*")
        .eq("order_id", orderId)
        .eq("bucket_name", CUSTOMER_INVENTORY_ORDER_LIST_BUCKET)
        .in("storage_path", paths),
    );
    if (error) throw error;
    const rows = requireRegisteredStorageRows<CustomerInventoryAttachment>(data, {
      errorMessage: unconfirmed,
      expectedParentId: orderId,
      expectedPaths: paths,
      parentField: "order_id",
      pathField: "storage_path",
    });
    const storage = supabase.storage.from(CUSTOMER_INVENTORY_ORDER_LIST_BUCKET);
    await confirmStoragePathsPresent(paths, (path) => withRequestTimeout(storage.exists(path)), unconfirmed);
    return rows;
  } catch (cause) {
    // 暂时读不到不等于事务未提交。保留同一批路径，下一次只核对这批文件。
    throw new InventoryAttachmentRegistrationPending(orderId, paths, cause);
  }
}
