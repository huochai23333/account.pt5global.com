import "server-only";

/** 登录检查由路由先完成，再有界读取正文，防止超大文件占满服务端内存。 */
export async function readDocumentBody(request: Request, maxBytes: number) {
  const length = Number(request.headers.get("content-length"));
  if (length > maxBytes) throw new Error("size");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > maxBytes) { await reader.cancel(); throw new Error("size"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}
export function checkDocumentOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("forbidden");
}
export function documentError(error: unknown) {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message ?? "");
  const key = /forbidden|permission|row.level|not.found/i.test(message) ? "forbidden"
    : /conflict|duplicate key/.test(message) ? "conflict"
    : /folder_not_empty/.test(message) ? "folderNotEmpty"
    : /default_folder/.test(message) ? "defaultFolder"
    : /share_confirmation/.test(message) ? "shareConfirmation"
    : /size/.test(message) ? "size" : /invalid/.test(message) ? "invalid" : "unconfirmed";
  return Response.json({ error: key }, { status: key === "forbidden" ? 403 : 400, headers: { "Cache-Control": "private, no-store" } });
}
