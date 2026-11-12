"use client";
import { useRef } from "react";
import { requireDocumentReceipt } from "@/lib/document-library/model";
import type { SaveAsBrowser } from "./use-save-as-browser";
/** 新建目录单独管理操作编号；断线后重用原编号，并独立核对父目录和实际记录。 */
export function useSaveAsFolderCreate(browser: SaveAsBrowser) {
  const { folderId, loadDirectories, navigate } = browser;
  const intent = useRef<{
    operationId: string;
    payload: { folderId: string; name: string };
  } | null>(null);
  async function createFolder(name: string) {
    if (!folderId || !name.trim()) throw new Error("document_invalid");
    if (
      intent.current?.payload.name !== name.trim() ||
      intent.current.payload.folderId !== folderId
    )
      intent.current = {
        operationId: crypto.randomUUID(),
        payload: { folderId, name: name.trim() },
      };
    const request = intent.current;
    const response = await fetch("/api/document-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, action: "create_folder" }),
      signal: AbortSignal.timeout(30_000),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(
        result.error === "folderNameConflict" ? "document_name_conflict" : "document_failed",
      );
    const expected = requireDocumentReceipt(result, request.operationId);
    const confirm = await fetch(
      `/api/document-library/reconcile?operationId=${request.operationId}`,
      { cache: "no-store", signal: AbortSignal.timeout(30_000) },
    );
    if (!confirm.ok) throw new Error("document_not_confirmed");
    const actual = requireDocumentReceipt(await confirm.json(), request.operationId);
    if (
      actual.action !== "create_folder" ||
      actual.record.id !== expected.record.id ||
      actual.record.version !== expected.record.version ||
      actual.record.name !== request.payload.name ||
      !("parent_id" in actual.record) ||
      actual.record.parent_id !== folderId
    )
      throw new Error("document_not_confirmed");
    // 已确认写入的目录还要出现在当前授权列表。列表暂不可读时，保留操作编号供重试。
    const directories = await loadDirectories();
    if (!directories?.folders.some((folder) =>
      folder.id === actual.record.id && folder.parent_id === folderId && folder.name === request.payload.name
    )) throw new Error("document_not_confirmed");
    intent.current = null;
    navigate(actual.record.id);
    return actual.record.id;
  }
  return createFolder;
}
