import type { SupabaseClient } from "@supabase/supabase-js";
import { withRequestTimeout } from "./request-timeout";
import { readStorageObjectPresence } from "./storage-operation-object-presence";
import { requireStorageUploadReceipt } from "./storage-operation-receipt-validation";
import {
  WholesaleOrderListUploadPending,
  wholesaleUploadFileHash,
  type WholesaleUploadPlan,
} from "./wholesale-order-list-upload-journal";

type Bucket = ReturnType<SupabaseClient["storage"]["from"]>;
type PlannedFile = WholesaleUploadPlan["files"][number];

async function readUploadedObject(bucket: Bucket, planned: PlannedFile) {
  try {
    const result = await withRequestTimeout(
      // 验收读取不能命中旧浏览器副本，否则文件删除或权限变化后仍可能误判已保存。
      bucket.download(planned.storage_path, undefined, { cache: "no-store" }),
    );
    if (!result.error && result.data) {
      if (
        result.data.size !== planned.file_size_bytes ||
        (await wholesaleUploadFileHash(result.data)) !== planned.sha256
      )
        throw new WholesaleOrderListUploadPending(
          new Error("附件正文与本次文件不一致。"),
        );
      return true;
    }
    // 下载失败也可能是断网或无权限；目录结果只代表当前可见范围，不能据此丢弃核对记录。
    const present = await withRequestTimeout(
      readStorageObjectPresence(bucket, planned.storage_path),
    );
    if (present)
      throw new WholesaleOrderListUploadPending(
        result.error ?? new Error("附件正文暂未读回。"),
      );
    return false;
  } catch (cause) {
    throw new WholesaleOrderListUploadPending(cause);
  }
}

export async function requireWholesaleUploadedObject(
  bucket: Bucket,
  planned: PlannedFile,
) {
  if (!(await readUploadedObject(bucket, planned)))
    throw new WholesaleOrderListUploadPending(
      new Error("已登记附件的文件暂未确认。"),
    );
}

/** 恢复只使用原路径。正常回执核对准确路径；丢失回执后独立比对实际字节摘要。 */
export async function uploadWholesalePlannedObject(
  bucket: Bucket,
  planned: PlannedFile,
  file: File,
  resuming: boolean,
) {
  if (resuming && (await readUploadedObject(bucket, planned))) return;
  try {
    const { data, error } = await withRequestTimeout(
      bucket.upload(planned.storage_path, file, {
        contentType: planned.mime_type,
        upsert: false,
      }),
      { message: "附件上传时间有些长，请稍后核对。", timeoutMs: 60000 },
    );
    if (error) throw error;
    requireStorageUploadReceipt(
      data,
      planned.storage_path,
      "附件没有确认上传成功。",
    );
  } catch (cause) {
    if (await readUploadedObject(bucket, planned)) return;
    // 目录暂时为空也可能是权限变化；保留原路径，恢复时仍用upsert:false防止覆盖。
    throw new WholesaleOrderListUploadPending(cause);
  }
  // 正常回包同样需要真实文件凭证，不能仅凭路径回执就继续登记。
  await requireWholesaleUploadedObject(bucket, planned);
}
