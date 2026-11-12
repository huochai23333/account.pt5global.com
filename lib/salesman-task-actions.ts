import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdminTaskAttachment } from "./admin-tasks-types";
import { withRequestTimeout } from "./request-timeout";

// 领取和完结由数据库函数检查资格；附件签名使用当前会话的 Storage 权限。
export async function acceptSalesmanTask(supabase: SupabaseClient, taskId: string) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("accept_task", {
      p_task_id: taskId,
    }),
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function completeSalesmanTask(supabase: SupabaseClient, acceptanceId: string) {
  const { data, error } = await withRequestTimeout(
    supabase.rpc("complete_task", {
      p_acceptance_id: acceptanceId,
    }),
  );

  if (error) {
    throw error;
  }

  return data;
}

export async function getTaskAttachmentSignedUrl(
  supabase: SupabaseClient,
  attachment: Pick<AdminTaskAttachment, "bucket_name" | "task_attachment_storage_path">,
  expiresIn = 60 * 10,
) {
  const { data, error } = await withRequestTimeout(
    supabase.storage
      .from(attachment.bucket_name)
      .createSignedUrl(attachment.task_attachment_storage_path, expiresIn),
  );

  if (error) {
    throw error;
  }

  return data.signedUrl;
}
