"use client";
import { useEffect, useState } from "react";
import { requireDocumentReceipt, type DocumentReceipt } from "@/lib/document-library/model";

export type DocumentIntent = { operationId: string; action: string; payload: Record<string, unknown> };
export type DocumentUploadResult = { name: string; ok: boolean; error?: string };
type Intent = DocumentIntent;
const KEY = "pt5.document.intent.";
/** 原操作编号按账号保存在当前浏览器会话；超时后核对原操作，避免自动重复写入。 */
export function useDocumentActions(userId: string, refresh: () => Promise<boolean>) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [successful, setSuccessful] = useState(false);
  const [outstanding, setOutstanding] = useState<Intent[]>([]);
  const [uploadResults, setUploadResults] = useState<DocumentUploadResult[]>([]);
  function restore() {
    const intents: Intent[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(KEY + userId + ".")) {
        try { intents.push(JSON.parse(sessionStorage.getItem(key) ?? "{}")); } catch { /* 损坏的浏览器缓存不能触发任何写操作。 */ }
      }
    }
    setOutstanding(intents.filter((intent) => typeof intent.operationId === "string" && typeof intent.action === "string" && !!intent.payload));
  }
  useEffect(() => {
    // 读取浏览器存储安排在挂载后，避免服务端首屏与浏览器水合结果不同。
    const timer = setTimeout(restore, 0);
    return () => clearTimeout(timer);
  // 恢复只依赖当前账号，操作结束时另外显式刷新待核对列表。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  async function confirmReceipt(receipt: unknown, operationId: string) {
    const expected = requireDocumentReceipt(receipt, operationId);
    const response = await fetch(`/api/document-library/reconcile?operationId=${operationId}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error("unconfirmed");
    const actual = requireDocumentReceipt(await response.json(), operationId);
    if (actual.record.id !== expected.record.id || actual.record.version !== expected.record.version || actual.action !== expected.action) throw new Error("unconfirmed");
  }
  async function run(intent: Intent, file?: File): Promise<{ ok: boolean; error?: string }> {
    const key = KEY + userId + "." + intent.operationId;
    sessionStorage.setItem(key, JSON.stringify(intent));
    try {
      let response: Response;
      if (file) {
        const form = new FormData();
        form.set("operationId", intent.operationId); form.set("folderId", String(intent.payload.folderId)); form.set("file", file);
        response = await fetch("/api/document-library/upload", { method: "POST", body: form, signal: AbortSignal.timeout(90_000) });
      } else {
        response = await fetch("/api/document-library", { method: "POST", body: JSON.stringify(intent), headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(90_000) });
      }
      const receipt = await response.json();
      if (!response.ok) throw new Error(receipt.error ?? "unconfirmed");
      await confirmReceipt(receipt, intent.operationId);
      sessionStorage.removeItem(key);
      return { ok: true };
    } catch (error) {
      if (error instanceof Error && ["busy","folderNameConflict","forbidden", "invalid", "size", "conflict", "folderNotEmpty", "defaultFolder", "shareConfirmation"].includes(error.message)) sessionStorage.removeItem(key);
      const reason = error instanceof Error && ["busy","folderNameConflict","forbidden", "invalid", "size", "conflict", "folderNotEmpty", "defaultFolder", "shareConfirmation", "partial"].includes(error.message) ? error.message : "unconfirmed";
      setMessage(reason);
      return { ok: false, error: reason };
    } finally { restore();
    }
  }
  async function command(action: string, payload: Record<string, unknown>, afterWrite = refresh) {
    if (busy) return false;
    setBusy(true); setMessage(""); setSuccessful(false); setUploadResults([]);
    try {
      const done = (await run({ operationId: crypto.randomUUID(), action, payload })).ok;
      const refreshed = await (done ? afterWrite() : refresh());
      if (done) { setSuccessful(refreshed); setMessage(refreshed ? "saved" : "savedRefreshing"); }
      return done;
    } finally { setBusy(false); }
  }
  async function upload(folderId: string, files: File[]) {
    if (busy || !files.length) return;
    setBusy(true); setMessage(""); setSuccessful(false); setUploadResults([]);
    let completed = 0;
    const results: DocumentUploadResult[] = [];
    try {
      for (const file of files) {
        const result = await run({ operationId: crypto.randomUUID(), action: "reserve_upload", payload: { folderId, name: file.name } }, file);
        if (result.ok) completed++;
        // 批量操作逐项保留真实核对结果，用户能知道哪份资料需要重新选择或继续核对。
        results.push({ name: file.name, ...result }); setUploadResults([...results]);
      }
      const refreshed = await refresh();
      if (completed === files.length) { setMessage(refreshed ? "saved" : "savedRefreshing"); setSuccessful(refreshed); }
      else if (completed > 0) setMessage("partial");
    } finally { setBusy(false); }
  }
  async function reconcile(receipt: Pick<DocumentReceipt, "operationId">) {
    if (busy) return;
    setBusy(true); setMessage(""); setSuccessful(false);
    let confirmed = false;
    try {
      // 上传缺少原文件时不能声称重试完成；服务器核对已存在的真实对象即可完成原登记。
      const response = await fetch("/api/document-library/reconcile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationId: receipt.operationId }), signal: AbortSignal.timeout(90_000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "unconfirmed");
      await confirmReceipt(result, receipt.operationId);
      sessionStorage.removeItem(KEY + userId + "." + receipt.operationId);
      confirmed = true;
      setMessage("saved"); setSuccessful(true);
    } catch { setMessage("unconfirmed"); }
    finally { const refreshed = await refresh(); if (!refreshed) { setSuccessful(false); if (confirmed) setMessage("savedRefreshing"); } restore(); setBusy(false); }
  }
  return { busy, message, successful, outstanding, uploadResults, command, upload, reconcile };
}
