import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";
import { removeStorageObjectsVerified, requireStorageUploadReceipt } from "@/lib/storage-operation-receipts";

import { getMailEnv } from "./mail-env";
import { sha256 } from "./mail-security";

const BLOCKED_EXTENSIONS = new Set([
  "ade", "adp", "app", "bat", "cmd", "com", "cpl", "exe", "hta", "ins", "iso", "jar",
  "js", "jse", "lnk", "msc", "msi", "msp", "mst", "ps1", "reg", "scr", "sh", "vb",
  "vbe", "vbs", "ws", "wsc", "wsf", "wsh",
]);

export function cleanAttachmentFilename(value: string) {
  const cleaned = value.normalize("NFKC").replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").trim();
  const filename = cleaned.slice(0, 180) || "attachment";
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  if (BLOCKED_EXTENSIONS.has(extension)) throw new Error("这类文件不能作为邮件附件发送。");
  return filename;
}

async function ensureAttachmentBucket() {
  const supabase = getSupabaseServiceRoleClient();
  const bucket = getMailEnv().attachmentBucket;
  const { data, error } = await supabase.storage.getBucket(bucket);
  if (data) return;
  if (error && !/not found/i.test(error.message)) throw new Error("附件存储状态暂时无法确认。", { cause: error });
  const created = await supabase.storage.createBucket(bucket, {
    public: false,
    fileSizeLimit: 10 * 1024 * 1024,
  });
  if (created.error) throw new Error("附件存储空间没有创建成功。", { cause: created.error });
}

/** 加密后的附件由服务端写入私有 bucket，浏览器不会获得服务密钥或永久地址。 */
export async function uploadEncryptedObject(path: string, encrypted: string) {
  await ensureAttachmentBucket();
  const payload = Buffer.from(encrypted, "utf8");
  const { data, error } = await getSupabaseServiceRoleClient().storage
    .from(getMailEnv().attachmentBucket)
    .upload(path, payload, { contentType: "application/octet-stream", upsert: false });
  if (error) throw new Error("附件没有保存成功。", { cause: error });
  requireStorageUploadReceipt(data, path, "附件对象路径没有确认保存。");
  return { cipherSha256: sha256(payload) };
}

export async function downloadEncryptedObject(path: string) {
  const { data, error } = await getSupabaseServiceRoleClient().storage
    .from(getMailEnv().attachmentBucket)
    .download(path);
  if (error || !data) throw new Error("附件文件不存在或暂时不可用。", { cause: error });
  return Buffer.from(await data.arrayBuffer()).toString("utf8");
}

export async function deleteEncryptedObjects(paths: string[]) {
  if (paths.length === 0) return;
  await removeStorageObjectsVerified(
    getSupabaseServiceRoleClient(),
    getMailEnv().attachmentBucket,
    paths,
    { confirmationMessage: "附件文件没有全部删除，请稍后重试。", timeoutMessage: "附件删除确认超时，请稍后重试。" },
  );
}

/** 扫描服务必须明确确认安全，附件才允许进入发信任务。 */
export async function scanAttachment(bytes: Buffer, filename: string) {
  const scannerUrl = getMailEnv().attachmentScannerUrl;
  if (!scannerUrl) return { clean: false, reason: "附件扫描服务尚未配置。" };
  const response = await fetch(scannerUrl, {
    method: "POST",
    headers: { "content-type": "application/octet-stream", "x-filename": encodeURIComponent(filename) },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) return { clean: false, reason: `附件扫描失败：${response.status}` };
  const result = (await response.json()) as { clean?: boolean; reason?: string };
  return { clean: result.clean === true, reason: result.reason ?? null };
}
