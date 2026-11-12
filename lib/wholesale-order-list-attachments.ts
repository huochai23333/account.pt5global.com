import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import { readStorageObjectPresence } from "./storage-operation-object-presence";
import { requireStorageRemoveDispatchReceipt } from "./storage-operation-receipt-validation";

export const WHOLESALE_ORDER_LIST_BUCKET = "wholesale-order-lists";
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

const SIGNED_DOWNLOAD_SECONDS = 60;
const DELETE_CONFIRMATION_ERROR = "附件删除尚未确认，请刷新后核对。";

export class WholesaleAttachmentDeleteIncomplete extends Error {
  readonly code = "partial_failed";

  constructor(cause: unknown) {
    super(DELETE_CONFIRMATION_ERROR, { cause });
  }
}

export async function deleteWholesaleOrderListAttachment(
  supabase: SupabaseClient,
  attachment: WholesaleOrderListAttachment,
) {
  const identity = {
    id: attachment.id,
    order_id: attachment.order_id,
    bucket_name: attachment.bucket_name,
    storage_path: attachment.storage_path,
  };
  const registrations = supabase.from("wholesale_order_list_attachments");
  // 先证明当前会话可读到这条准确登记。该登记也是 Storage SELECT 策略的可见依据。
  const { data: registration, error: readError } = await withRequestTimeout(
    registrations.select("id").match(identity).maybeSingle<{ id: string }>(),
  );
  if (readError || registration?.id !== attachment.id) {
    throw readError ?? new Error(DELETE_CONFIRMATION_ERROR);
  }

  const bucket = supabase.storage.from(attachment.bucket_name);
  const objectExists = () => withRequestTimeout(readStorageObjectPresence(bucket, attachment.storage_path));
  if (await objectExists()) {
    const { data, error } = await withRequestTimeout(
      bucket.remove([attachment.storage_path]),
      { timeoutMs: 60_000 },
    );
    if (error) throw error;
    requireStorageRemoveDispatchReceipt(data, DELETE_CONFIRMATION_ERROR);
    if (await objectExists()) throw new Error(DELETE_CONFIRMATION_ERROR);
  }

  // 如果上一轮已移除对象，重试从现存登记续办。只有删掉同一条登记才返回完成。
  try {
    const { data, error } = await withRequestTimeout(
      registrations.delete().match(identity).select("id").maybeSingle<{ id: string }>(),
    );
    if (error || data?.id !== attachment.id) {
      throw error ?? new Error(DELETE_CONFIRMATION_ERROR);
    }
  } catch (error) {
    throw new WholesaleAttachmentDeleteIncomplete(error);
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
