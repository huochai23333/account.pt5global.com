import type { SupabaseClient } from "@supabase/supabase-js";
import { getCurrentAppAccessContext } from "@/lib/current-app-access-context";
import { withRequestTimeout } from "@/lib/request-timeout";
import { removeStorageObjectsVerified, requireStorageUploadReceipt } from "@/lib/storage-operation-receipts";

export const QUOTE_IMAGE_BUCKET = "quotation-images";
const STAFF = new Set(["administrator", "manager", "operator", "recruiter", "salesman", "promoter", "finance"]);

export async function uploadQuoteImage(supabase: SupabaseClient, file: File) {
  if (!(["image/png", "image/jpeg", "image/webp"].includes(file.type)) || file.size > 5 * 1024 * 1024)
    throw new Error("Use a PNG, JPG or WebP image under 5 MB.");
  const [{ data: auth, error: authError }, access] = await Promise.all([
    supabase.auth.getUser(), getCurrentAppAccessContext(supabase),
  ]);
  if (authError || !auth.user || access.status !== "active" || !STAFF.has(access.role ?? ""))
    throw new Error("quotation_image_forbidden");
  // 路径第一段固定为登录人 ID，存储 RLS 据此拒绝读取或删除别人的图片。
  const path = `${auth.user.id}/${crypto.randomUUID()}`;
  const bucket = supabase.storage.from(QUOTE_IMAGE_BUCKET);
  const { data, error } = await withRequestTimeout(bucket.upload(path, file, {
    contentType: file.type, upsert: false,
  }), { timeoutMs: 60_000 });
  if (error) throw error;
  requireStorageUploadReceipt(data, path, "Image upload was not confirmed.");
  // 上传接口的回执不足以证明文件存在，额外查一次私有存储对象。
  const { data: exists, error: existsError } = await withRequestTimeout(bucket.exists(path));
  if (existsError || !exists) throw new Error("Image upload was not confirmed.");
  return path;
}
export async function readQuoteImage(supabase: SupabaseClient, path: string): Promise<string> {
  // 生成 PDF 前从私有存储重新取图，不能相信页面中旧的预览地址。
  const { data, error } = await withRequestTimeout(supabase.storage.from(QUOTE_IMAGE_BUCKET).download(path));
  if (error || !data) throw error ?? new Error("Image is unavailable.");
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image is unavailable."));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(data);
  });
}
export async function removeQuoteImages(supabase: SupabaseClient, paths: string[]) {
  return removeStorageObjectsVerified(supabase, QUOTE_IMAGE_BUCKET, paths, {
    confirmationMessage: "Some product images were not removed.",
    timeoutMessage: "Product image cleanup timed out.",
  });
}
