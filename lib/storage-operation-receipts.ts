import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";
import {
  confirmStoragePathsMissing,
  confirmStoragePathsPresent,
  requireStorageRemoveDispatchReceipt,
} from "./storage-operation-receipt-validation";

export {
  requireRegisteredStorageRows,
  requireStorageUploadReceipt,
} from "./storage-operation-receipt-validation";

type StorageReceiptOptions = {
  confirmationMessage: string;
  timeoutMessage: string;
};

/**
 * Storage 删除接口即使返回 2xx，也可能只返回空数组，所以不能用响应数组数量判断。
 * 删除后逐个查询对象是否仍存在，只有全部确认不存在才把删除视为完成。
 */
export async function removeStorageObjectsVerified(
  supabase: SupabaseClient,
  bucketName: string,
  storagePaths: string[],
  options: StorageReceiptOptions,
) {
  const uniquePaths = [...new Set(storagePaths.filter(Boolean))];
  if (uniquePaths.length === 0) return [];

  const bucket = supabase.storage.from(bucketName);
  const checkExistence = (storagePath: string) =>
    withRequestTimeout(bucket.exists(storagePath), {
      message: options.timeoutMessage,
      timeoutMs: 30_000,
    });

  // Storage 删除接口在真实删除和 0 行删除时都可能返回空数组。
  // 先证明对象存在，删除后再证明对象消失，才能形成完整的业务凭证。
  await confirmStoragePathsPresent(
    uniquePaths,
    checkExistence,
    options.confirmationMessage,
  );

  const { data, error } = await withRequestTimeout(bucket.remove(uniquePaths), {
    message: options.timeoutMessage,
    timeoutMs: 60_000,
  });

  if (error) throw error;
  requireStorageRemoveDispatchReceipt(data, options.confirmationMessage);

  await confirmStoragePathsMissing(
    uniquePaths,
    checkExistence,
    options.confirmationMessage,
  );

  return uniquePaths;
}
