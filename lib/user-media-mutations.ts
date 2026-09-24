import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  MediaKind,
  UserMediaAssetRow,
} from "./user-self-service-types";
import { withRequestTimeout } from "./request-timeout";
import { normalizeOptionalString } from "./value-normalizers";

const USER_MEDIA_MUTATION_TIMEOUT_MS = 60_000;
const USER_MEDIA_MUTATION_TIMEOUT_MESSAGE = "媒体操作超时，请稍后重试。";
const PENDING_UPLOAD_KEYS = new Map<string, { idempotencyKey: string; createdAt: number }>();

export async function uploadUserMedia(
  supabase: SupabaseClient,
  options: { userId: string; kind: MediaKind; files: File[] },
) {
  if (options.files.length === 0) return;

  const formData = new FormData();
  const uploadKey = await buildUploadIdempotencyKey(options);
  formData.set("action", "upload");
  formData.set("kind", options.kind);
  formData.set("idempotencyKey", uploadKey.idempotencyKey);
  for (const file of options.files) {
    formData.append("files", file, file.name);
  }
  const result = await invokeUserMediaMutation(supabase, formData);
  assertUploadCompleted(result, options.files.length);
  // 已拿到完整业务回执后释放本地键；以后确实需要再次上传同一文件时会生成新编号。
  PENDING_UPLOAD_KEYS.delete(uploadKey.cacheKey);
}

export async function deleteUserMediaAssets(
  supabase: SupabaseClient,
  assets: Array<Pick<UserMediaAssetRow, "bucket_name" | "storage_path" | "id">>,
) {
  if (assets.length === 0) return;
  const assetIds = assets.map((asset) => asset.id).sort();
  const result = await invokeUserMediaMutation(supabase, {
    action: "delete",
    assetIds,
    idempotencyKey: `delete:${assetIds.join(":")}`,
  });
  assertDeleteCompleted(result, assetIds.length);
}

async function invokeUserMediaMutation(
  supabase: SupabaseClient,
  body: FormData | { action: "delete"; assetIds: string[]; idempotencyKey: string },
) {
  const { data, error } = await withRequestTimeout(
    supabase.functions.invoke("user-media-mutate", { body }),
    {
      timeoutMs: USER_MEDIA_MUTATION_TIMEOUT_MS,
      message: USER_MEDIA_MUTATION_TIMEOUT_MESSAGE,
    },
  );
  if (error) throw await toUserMediaMutationError(error);
  return data;
}

function assertUploadCompleted(value: unknown, expectedCount: number) {
  const result = readMutationResult(value);
  if (
    result.status !== "succeeded" ||
    result.uploadStatus !== "succeeded" ||
    result.uploadedCount !== expectedCount ||
    !Array.isArray(result.uploadedAssetIds) ||
    result.uploadedAssetIds.length !== expectedCount
  ) {
    throw createIncompleteMutationError(result);
  }
}

function assertDeleteCompleted(value: unknown, expectedCount: number) {
  const result = readMutationResult(value);
  // Edge Function 必须明确返回 Storage 的删除后复查结果；只有数据库数量正确仍不够，
  // 否则文件留在对象存储时页面会错误显示“已删除”。
  if (
    result.status !== "succeeded" ||
    result.deletedCount !== expectedCount ||
    result.storageDeletionVerified !== true
  ) {
    throw createIncompleteMutationError(result);
  }
}

function readMutationResult(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("媒体操作没有返回可确认的结果，请稍后刷新页面查看。");
  }
  if (typeof (value as Record<string, unknown>).operationId !== "string") {
    throw new Error("媒体操作没有返回运行编号，请稍后刷新页面查看。");
  }
  return value as Record<string, unknown>;
}

function createIncompleteMutationError(result: Record<string, unknown>) {
  if (result.status === "queued" || result.status === "running") {
    return new Error("操作结果仍在确认中，请稍后刷新页面查看，暂时不要重复提交。");
  }
  const message = typeof result.message === "string" ? result.message : "";
  return new Error(isUserFacingMediaMessage(message)
    ? message
    : "照片或视频暂时无法保存，请稍后重试。", { cause: result });
}

async function buildUploadIdempotencyKey(options: {
  userId: string;
  kind: MediaKind;
  files: File[];
}) {
  const fileFingerprints = await Promise.all(options.files.map(async (file) => {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const hex = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    return `${file.name}:${file.size}:${file.lastModified}:${hex}`;
  }));
  const cacheInput = new TextEncoder().encode(
    `${options.userId}:${options.kind}:${fileFingerprints.sort().join("|")}`,
  );
  const cacheDigest = await crypto.subtle.digest("SHA-256", cacheInput);
  const cacheKey = Array.from(new Uint8Array(cacheDigest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
  const existing = PENDING_UPLOAD_KEYS.get(cacheKey);
  if (existing && Date.now() - existing.createdAt < 15 * 60_000) {
    return { cacheKey, idempotencyKey: existing.idempotencyKey };
  }

  const idempotencyKey = `upload:${crypto.randomUUID()}`;
  PENDING_UPLOAD_KEYS.set(cacheKey, { createdAt: Date.now(), idempotencyKey });
  return { cacheKey, idempotencyKey };
}

async function toUserMediaMutationError(error: unknown) {
  const response = getFunctionErrorResponse(error);
  if (response) {
    try {
      const payload = (await response.clone().json()) as {
        error?: string;
        message?: string;
      };
      const message =
        normalizeOptionalString(payload.message) ??
        normalizeOptionalString(payload.error);
      if (message && isUserFacingMediaMessage(message)) return new Error(message);
    } catch {
      // 响应不是 JSON 时保留 Supabase 客户端原始错误，便于调用方统一记录。
    }
  }
  // 网络、DNS 和平台异常只保留在 cause 中，不直接显示给用户。
  return new Error("照片或视频暂时无法上传，请检查网络后重试。", { cause: error });
}

function isUserFacingMediaMessage(message: string) {
  return /[\u3400-\u9fff]/u.test(message) && !/\b(?:status|rpc|queue|error|failed)\b/iu.test(message);
}

function getFunctionErrorResponse(error: unknown) {
  if (typeof error !== "object" || error === null || !("context" in error)) {
    return null;
  }
  const { context } = error as { context?: unknown };
  return context instanceof Response ? context : null;
}
