import { requireCompanyTemplateApiAccess } from "../access";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { readCompanyTemplateErrorMessage } from "../display-error";
import { MAX_DOCUMENT_BYTES, type DocumentMutation } from "./model";
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
export async function documentAccess() { await requireCompanyTemplateApiAccess(); return getServerSupabaseClient(); }
/** 读取长度有上限，填写数据与文件图片一起计入 10 MiB；未知字段不交给数据库。 */
export async function readDocumentMutation(request: Request): Promise<DocumentMutation> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("document_invalid");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_DOCUMENT_BYTES + 4096) { await reader.cancel(); throw new Error("document_too_large"); } chunks.push(value); }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8")) as DocumentMutation;
  if (!body || !["create","save","rename","copy","delete"].includes(body.action) || !UUID.test(body.documentId) || !UUID.test(body.operationId)) throw new Error("document_invalid");
  if (body.action === "create" && !UUID.test(body.templateId ?? "")) throw new Error("document_invalid");
  if (body.action === "copy" && !UUID.test(body.sourceId ?? "")) throw new Error("document_invalid");
  if (["rename","save","delete"].includes(body.action) && (!Number.isInteger(body.expectedRevision) || Number(body.expectedRevision) < 1)) throw new Error("document_invalid");
  if (["create","rename","copy"].includes(body.action) && (typeof body.name !== "string" || !body.name.trim() || body.name.trim().length > 120)) throw new Error("document_invalid");
  if (body.action === "save" || body.state !== undefined) {
    if (!body.state || typeof body.state !== "object" || Array.isArray(body.state)) throw new Error("document_invalid");
    if (Buffer.byteLength(JSON.stringify(body.state)) > MAX_DOCUMENT_BYTES) throw new Error("document_too_large");
  }
  return { action: body.action, documentId: body.documentId, operationId: body.operationId,
    ...(body.expectedRevision !== undefined ? { expectedRevision: body.expectedRevision } : {}),
    ...(body.name !== undefined ? { name: body.name.trim() } : {}),
    ...(body.templateId ? { templateId: body.templateId } : {}), ...(body.sourceId ? { sourceId: body.sourceId } : {}), ...(body.state ? { state: body.state } : {}) };
}
export function documentFailure(cause: unknown) {
  const message = readCompanyTemplateErrorMessage(cause);
  const error = ["document_conflict","document_missing","document_forbidden","document_too_large","document_unsupported","document_invalid","document_not_confirmed"].find((code) => message.includes(code)) ?? (message.includes("forbidden") ? "document_forbidden" : "document_failed");
  return Response.json({ ok: false, error }, { status: error === "document_conflict" ? 409 : error === "document_forbidden" ? 403 : error === "document_missing" ? 404 : 400 });
}
