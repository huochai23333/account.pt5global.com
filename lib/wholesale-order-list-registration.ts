import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import { requireRegisteredStorageRows } from "./storage-operation-receipts";
import { confirmStoragePathsPresent } from "./storage-operation-receipt-validation";
import {
  WHOLESALE_ORDER_LIST_BUCKET,
  type WholesaleOrderListAttachment,
} from "./wholesale-order-list-attachments";

export type WholesaleOrderListUpload = Pick<
  WholesaleOrderListAttachment,
  "storage_path" | "original_name" | "mime_type" | "file_size_bytes"
>;

const missingReceipt = "附件登记结果还需要核对。";

export class WholesaleOrderListRegistrationPending extends Error {
  // 文件可能已保存，登记尚未确认，不能把这一阶段标为完整成功。
  readonly code = "partial_failed";
  constructor(
    readonly orderId: string,
    readonly paths: string[],
    cause: unknown,
  ) {
    super(missingReceipt, { cause });
  }
}

export async function registerWholesaleOrderListUploads(
  supabase: SupabaseClient,
  orderId: string,
  uploads: WholesaleOrderListUpload[],
) {
  const paths = uploads.map((upload) => upload.storage_path);
  try {
    const { data, error, status } = await withRequestTimeout(
      supabase.rpc("register_wholesale_order_list_attachments", {
        p_attachments: uploads,
        p_order_id: orderId,
      }),
    );
    // 只有数据库明确拒绝了整个事务，调用者才可补偿删除这批对象。
    if (
      error &&
      status >= 400 &&
      status < 500 &&
      /^(?:22[0-9A-Z]{3}|23[0-9A-Z]{3}|42501)$/.test(error.code)
    ) {
      // 重复写入或权限变化时，空查询不一定代表原登记不存在，不能因此回收对象。
      if (error.code === "23505" || error.code === "42501") throw error;
      // 另一个标签页可能已提交相同路径。读回失败或部分登记时保留对象；完整原登记可作为回执。
      const existing = await readRegistrations(supabase, orderId, paths);
      if (existing.error || !Array.isArray(existing.data))
        throw existing.error ?? new Error(missingReceipt);
      if (existing.data.length > 0)
        return {
          kind: "registered" as const,
          rows: requireReceipt(existing.data, orderId, paths),
        };
      return { kind: "rejected" as const, error };
    }
    if (error) throw error;
    return {
      kind: "registered" as const,
      rows: requireReceipt(data, orderId, paths),
    };
  } catch {
    // 网络中断或空回执可能发生在提交之后，改按订单和本次路径读回。
    const rows = await confirmWholesaleOrderListUploads(
      supabase,
      orderId,
      paths,
    );
    return { kind: "registered" as const, rows };
  }
}

export async function confirmWholesaleOrderListUploads(
  supabase: SupabaseClient,
  orderId: string,
  paths: string[],
) {
  try {
    const { data, error } = await readRegistrations(supabase, orderId, paths);
    if (error) throw error;
    const rows = requireReceipt(data, orderId, paths);
    const bucket = supabase.storage.from(WHOLESALE_ORDER_LIST_BUCKET);
    await confirmStoragePathsPresent(
      paths,
      (storagePath) => withRequestTimeout(bucket.exists(storagePath)),
      missingReceipt,
    );
    return rows;
  } catch (cause) {
    // 一次读到零行可能只是原事务还未结束。保留对象和核对范围，避免误删或重传。
    throw new WholesaleOrderListRegistrationPending(orderId, paths, cause);
  }
}

function readRegistrations(
  supabase: SupabaseClient,
  orderId: string,
  paths: string[],
) {
  return withRequestTimeout(
    supabase
      .from("wholesale_order_list_attachments")
      .select("*")
      .eq("order_id", orderId)
      .eq("bucket_name", WHOLESALE_ORDER_LIST_BUCKET)
      .in("storage_path", paths),
  );
}

function requireReceipt(data: unknown, orderId: string, paths: string[]) {
  return requireRegisteredStorageRows<WholesaleOrderListAttachment>(data, {
    errorMessage: missingReceipt,
    expectedParentId: orderId,
    expectedPaths: paths,
    parentField: "order_id",
    pathField: "storage_path",
  });
}
