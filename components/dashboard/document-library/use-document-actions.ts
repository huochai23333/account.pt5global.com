"use client";
import { useEffect, useState } from "react";
import type { DocumentReceipt } from "@/lib/document-library/model";
import {
  getDocumentRequestError,
  reconcileDocumentIntent,
  shouldKeepDocumentIntent,
  submitDocumentIntent,
  type DocumentIntent,
} from "@/lib/document-library/operation-client";

export type DocumentUploadResult = { operationId: string; name: string; ok: boolean; error?: string };
const KEY = "pt5.document.intent.";
/** 原操作编号按账号保存在当前浏览器会话；超时后核对原操作，避免自动重复写入。 */
export function useDocumentActions(userId: string, refresh: () => Promise<boolean>) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [successful, setSuccessful] = useState(false);
  const [outstanding, setOutstanding] = useState<DocumentIntent[]>([]);
  const [uploadResults, setUploadResults] = useState<DocumentUploadResult[]>([]);
  function restore() {
    const intents: DocumentIntent[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(KEY + userId + ".")) {
        try {
          intents.push(JSON.parse(sessionStorage.getItem(key) ?? "{}"));
        } catch {
          /* 损坏的浏览器缓存不能触发任何写操作。 */
        }
      }
    }
    setOutstanding(
      intents.filter(
        (intent) =>
          typeof intent.operationId === "string" &&
          typeof intent.action === "string" &&
          !!intent.payload,
      ),
    );
  }
  useEffect(() => {
    // 读取浏览器存储安排在挂载后，避免服务端首屏与浏览器水合结果不同。
    const timer = setTimeout(restore, 0);
    return () => clearTimeout(timer);
    // 恢复只依赖当前账号，操作结束时另外显式刷新待核对列表。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);
  async function run(
    intent: DocumentIntent,
    file?: File,
  ): Promise<{ ok: boolean; error?: string; receipt?: DocumentReceipt }> {
    const key = KEY + userId + "." + intent.operationId;
    sessionStorage.setItem(key, JSON.stringify(intent));
    try {
      const actual = await submitDocumentIntent(intent, file);
      sessionStorage.removeItem(key);
      return { ok: true, receipt: actual };
    } catch (error) {
      const reason = getDocumentRequestError(error);
      if (!shouldKeepDocumentIntent(reason)) sessionStorage.removeItem(key);
      setMessage(reason);
      return { ok: false, error: reason };
    } finally {
      restore();
    }
  }
  async function command(action: string, payload: Record<string, unknown>, afterWrite = refresh) {
    if (busy) return false;
    setBusy(true);
    setMessage("");
    setSuccessful(false);
    setUploadResults([]);
    try {
      const done = (await run({ operationId: crypto.randomUUID(), action, payload })).ok;
      const refreshed = await (done ? afterWrite() : refresh());
      if (done) {
        setSuccessful(refreshed);
        setMessage(refreshed ? "saved" : "savedRefreshing");
      }
      return done;
    } finally {
      setBusy(false);
    }
  }
  /** 行内新建必须拿到服务端分配的真实名称和编号；未知结果保留原意图供核对，不能重新创建。 */
  async function write(action: string, payload: Record<string, unknown>, operationId: string) {
    if (busy) throw new Error("busy");
    setBusy(true);
    setMessage("");
    setSuccessful(false);
    try {
      const result = await run({ operationId, action, payload });
      if (!result.ok || !result.receipt) throw new Error(result.error ?? "unconfirmed");
      const refreshed = await refresh();
      setSuccessful(refreshed);
      setMessage(refreshed ? "saved" : "savedRefreshing");
      return result.receipt;
    } finally {
      setBusy(false);
    }
  }
  async function upload(folderId: string, files: File[]) {
    if (busy || !files.length) return;
    setBusy(true);
    setMessage("");
    setSuccessful(false);
    setUploadResults([]);
    let completed = 0;
    const results: DocumentUploadResult[] = [];
    try {
      for (const file of files) {
        const operationId = crypto.randomUUID();
        const result = await run(
          {
            operationId,
            action: "reserve_upload",
            payload: { folderId, name: file.name },
          },
          file,
        );
        if (result.ok) completed++;
        // 批量操作逐项保留真实核对结果，用户能知道哪份资料需要重新选择或继续核对。
        results.push({ operationId, name: file.name, ok: result.ok, error: result.error });
        setUploadResults([...results]);
      }
      const refreshed = await refresh();
      if (completed === files.length) {
        setMessage(refreshed ? "saved" : "savedRefreshing");
        setSuccessful(refreshed);
      } else if (completed > 0) setMessage("partial");
    } finally {
      setBusy(false);
    }
  }
  async function reconcile(receipt: Pick<DocumentReceipt, "operationId">) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    setSuccessful(false);
    let confirmed = false;
    let finalRead = false;
    let hasRemainingFailures = false;
    try {
      // 上传缺少原文件时不能声称重试完成；服务器核对已存在的真实对象即可完成原登记。
      await reconcileDocumentIntent(receipt.operationId);
      sessionStorage.removeItem(KEY + userId + "." + receipt.operationId);
      confirmed = true;
      // 用操作编号更新同一批次的这一行。同名文件或其他失败项保留各自结果。
      const updated = uploadResults.map((result) => result.operationId === receipt.operationId
        ? { operationId: result.operationId, name: result.name, ok: true }
        : result);
      setUploadResults(updated);
      hasRemainingFailures = updated.some((result) => !result.ok);
      setMessage(hasRemainingFailures ? "partial" : "saved");
      setSuccessful(!hasRemainingFailures);
    } catch (error) {
      // 权限撤回是明确拒绝。保留原意图，日后恢复权限可继续核对。
      const reason = getDocumentRequestError(error);
      const belongsToBatch = uploadResults.some((result) => result.operationId === receipt.operationId);
      if (belongsToBatch) {
        setUploadResults(uploadResults.map((result) => result.operationId === receipt.operationId
          ? { ...result, ok: false, error: reason }
          : result));
      }
      setMessage(belongsToBatch && uploadResults.some((result) => result.ok && result.operationId !== receipt.operationId)
        ? "partial"
        : reason);
    } finally {
      const refreshed = await refresh();
      finalRead = refreshed;
      if (!refreshed) {
        setSuccessful(false);
        if (confirmed && !hasRemainingFailures) setMessage("savedRefreshing");
      }
      restore();
      setBusy(false);
    }
    return confirmed && finalRead;
  }
  // 开始另一类写入前清除旧提示，不能让上一次保存成功冒充当前操作的结果。
  function clearFeedback() {
    setMessage("");
    setSuccessful(false);
  }
  return {
    clearFeedback,
    busy,
    message,
    successful,
    outstanding,
    uploadResults,
    command,
    write,
    upload,
    reconcile,
  };
}
