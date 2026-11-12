import { requireDocumentReceipt } from "./model";

export type DocumentIntent = {
  operationId: string;
  action: string;
  payload: Record<string, unknown>;
};

const definitiveErrors = new Set([
  "busy", "folderNameConflict", "forbidden", "invalid", "size", "conflict", "folderNotEmpty", "defaultFolder",
]);

export function getDocumentRequestError(error: unknown) {
  if (error instanceof Error && (definitiveErrors.has(error.message) || error.message === "partial"))
    return error.message;
  return "unconfirmed";
}

/** 明确拒绝的请求不需要在浏览器里继续恢复，传输错误则保留原操作。 */
export function shouldKeepDocumentIntent(error: string) {
  return !definitiveErrors.has(error);
}

async function postDocumentOperation(path: string, body: FormData | Record<string, unknown>) {
  const multipart = body instanceof FormData;
  const response = await fetch(path, {
    method: "POST",
    ...(multipart ? {} : { headers: { "Content-Type": "application/json" } }),
    body: multipart ? body : JSON.stringify(body),
    signal: AbortSignal.timeout(90_000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? "unconfirmed");
  return result;
}

async function confirmDocumentReceipt(receipt: unknown, operationId: string) {
  const expected = requireDocumentReceipt(receipt, operationId);
  // 单独读回服务器保存的凭证，页面的写入响应不能证明自己的编号与版本。
  const response = await fetch(`/api/document-library/reconcile?operationId=${operationId}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("unconfirmed");
  const actual = requireDocumentReceipt(await response.json(), operationId);
  if (
    actual.record.id !== expected.record.id ||
    actual.record.version !== expected.record.version ||
    actual.action !== expected.action
  ) throw new Error("unconfirmed");
  return actual;
}

export async function submitDocumentIntent(intent: DocumentIntent, file?: File) {
  if (!file) {
    const receipt = await postDocumentOperation("/api/document-library", intent);
    return confirmDocumentReceipt(receipt, intent.operationId);
  }
  const form = new FormData();
  form.set("operationId", intent.operationId);
  form.set("folderId", String(intent.payload.folderId));
  form.set("file", file);
  const receipt = await postDocumentOperation("/api/document-library/upload", form);
  return confirmDocumentReceipt(receipt, intent.operationId);
}

export async function reconcileDocumentIntent(operationId: string) {
  const receipt = await postDocumentOperation("/api/document-library/reconcile", { operationId });
  return confirmDocumentReceipt(receipt, operationId);
}
