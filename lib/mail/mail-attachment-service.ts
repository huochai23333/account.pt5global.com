import { randomUUID } from "node:crypto";

import { getSupabaseServiceRoleClient } from "@/lib/supabase-admin-server";

import { getMailEnv } from "./mail-env";
import { decryptMailValue, encryptMailValue } from "./mail-security";
import {
  cleanAttachmentFilename,
  deleteEncryptedObjects,
  downloadEncryptedObject,
  scanAttachment,
  uploadEncryptedObject,
} from "./mail-storage";
import { assertThreadAccess, databaseError } from "./mail-service";
import type { MailIdentity } from "./mail-types";

/** 附件上传、扫描和下载独立处理，下载仍需重新核对会话归属。 */

export async function uploadMailAttachment(identity: MailIdentity, input: {
  filename: string;
  contentType: string;
  base64: string;
}) {
  const filename = cleanAttachmentFilename(input.filename);
  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) throw new Error("单个附件必须小于 10 MiB。");
  const id = randomUUID();
  const storagePath = `${identity.userId}/uploads/${id}`;
  const encrypted = encryptMailValue(bytes.toString("base64"), getMailEnv().contentKey);
  const [stored, scan] = await Promise.all([
    uploadEncryptedObject(storagePath, encrypted),
    scanAttachment(bytes, filename),
  ]);
  const status = scan.clean ? "clean" : "quarantined";
  const { data, error } = await getSupabaseServiceRoleClient().from("mail_uploads").insert({
    id,
    user_id: identity.userId,
    storage_path: storagePath,
    filename_enc: encryptMailValue(filename, getMailEnv().contentKey),
    content_type_enc: encryptMailValue(input.contentType || "application/octet-stream", getMailEnv().contentKey),
    byte_size: bytes.length,
    cipher_sha256: stored.cipherSha256,
    scan_status: status,
    scan_error: scan.clean ? null : scan.reason,
  }).select("id,byte_size,scan_status").single();
  if (error || data?.id !== id) {
    await deleteEncryptedObjects([storagePath]).catch(() => undefined);
    databaseError("附件记录没有确认保存。", error);
  }
  return { attachmentId: id, filename, byteSize: Number(data.byte_size), status: data.scan_status as string };
}

export async function downloadMailAttachment(identity: MailIdentity, attachmentId: string) {
  const supabase = getSupabaseServiceRoleClient();
  const { data: attachment, error } = await supabase.from("mail_attachments")
    .select("id,message_id,storage_path,filename_enc,content_type_enc,scan_status")
    .eq("id", attachmentId).maybeSingle();
  if (error) databaseError("附件权限暂时无法确认。", error);
  if (!attachment || attachment.scan_status !== "clean") throw new Error("附件不存在或仍在安全检查中。");
  const { data: message, error: messageError } = await supabase.from("mail_messages")
    .select("thread_id").eq("id", attachment.message_id).single();
  if (messageError || !message) databaseError("附件所属会话暂时无法确认。", messageError);
  await assertThreadAccess(identity, message.thread_id as string, true);
  const encrypted = await downloadEncryptedObject(attachment.storage_path as string);
  return {
    filename: decryptMailValue(String(attachment.filename_enc), getMailEnv().contentKey),
    contentType: decryptMailValue(String(attachment.content_type_enc), getMailEnv().contentKey),
    base64: decryptMailValue(encrypted, getMailEnv().contentKey),
  };
}
