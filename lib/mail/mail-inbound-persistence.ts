import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { deleteEncryptedObjects } from "./mail-storage";

/**
 * RPC 可能已提交但 HTTP 回执丢失。先独立查询附件引用，只删没有数据库记录的暂存对象。
 * 查询失败时宁可保留待清理的对象，也不能删掉已经归档邮件正在使用的附件。
 */
export async function deleteUnreferencedInboundObjects(paths: string[]) {
  if (paths.length === 0) return;
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_attachments")
    .select("storage_path").in("storage_path", paths);
  if (error) throw new Error("来信附件引用暂时无法确认。", { cause: error });
  const referenced = new Set((data ?? []).map((row) => String(row.storage_path)));
  const unreferenced = paths.filter((path) => !referenced.has(path));
  if (unreferenced.length > 0) await deleteEncryptedObjects(unreferenced);
}
