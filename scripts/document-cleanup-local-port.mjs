import { readStorageObjectPresence } from "../lib/storage-operation-object-presence.ts";

/** 本地与后台共用清理引擎；目录读取必须成功，精确对象消失后才允许完成数据库登记。 */
export function createLocalDocumentCleanupPort(admin) {
  const bucket = admin.storage.from("document-library");
  return {
    claim: async () => {
      const result = await admin.rpc("document_library_claim_cleanup");
      if (result.error) throw result.error;
      return result.data;
    },
    // 不使用 HEAD 的 false 值；400、权限和网络错误不能冒充对象已经删除。
    exists: async path => ({ data: await readStorageObjectPresence(bucket, path), error: null }),
    remove: path => bucket.remove([path]),
    finish: async (target, success) => {
      const result = await admin.rpc("document_library_finish", {
        p_operation: target.operation_id,
        p_actor: target.actor_id,
        p_success: success,
        p_cleanup: true,
      });
      if (result.error) throw result.error;
      return result.data;
    },
  };
}
