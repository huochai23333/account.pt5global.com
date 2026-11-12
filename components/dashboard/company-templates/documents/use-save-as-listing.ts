"use client";

import { useEffect, useState } from "react";
import type { ExplorerItem } from "@/lib/document-library/model";

type Listing = {
  key: string;
  items: ExplorerItem[];
  total: number;
  error: string;
};

/** 查询键随目录、搜索、分页和重试变化，只有当前查询结果才能解除保存等待。 */
export function useSaveAsListing(folderId: string, query: string, page: number) {
  const [attempt, setAttempt] = useState(0);
  const [listing, setListing] = useState<Listing | null>(null);
  const key = JSON.stringify([folderId, query, page, attempt]);

  useEffect(() => {
    if (!folderId) return;
    const controller = new AbortController();
    const timer = setTimeout(load, query ? 300 : 0);

    async function load() {
      try {
        const params = new URLSearchParams({ folder: folderId, query, page: String(page) });
        const response = await fetch(`/api/company-template-documents/save-as?${params}`, {
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error ?? "document_failed");
        // 即使 HTTP 成功，缺少列表或数量也无法确认当前目录，保留重试入口。
        if (!Array.isArray(result?.items) || !result.items.every(isExplorerItem)
          || !Number.isSafeInteger(result.total) || result.total < 0) {
          throw new Error("document_failed");
        }
        if (!controller.signal.aborted) {
          setListing({ key, items: result.items, total: result.total, error: "" });
        }
      } catch (cause) {
        // 目录切换与卸载会主动中止旧请求，晚到结果和取消产生的错误都无需展示。
        if (!controller.signal.aborted) {
          const error = cause instanceof Error ? cause.message : "document_failed";
          setListing({ key, items: [], total: 0, error });
        }
      }
    }

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [folderId, query, page, key]);

  const current = folderId && listing?.key === key ? listing : null;
  return {
    items: current?.items ?? [],
    total: current?.total ?? 0,
    loading: Boolean(folderId) && !current,
    error: current?.error ?? "",
    refresh: () => setAttempt((value) => value + 1),
  };
}

function isExplorerItem(item: ExplorerItem | null) {
  if (!item || typeof item.id !== "string" || typeof item.name !== "string") return false;
  if (item.kind === "archive" || item.kind === "location") return true;
  if (!("path" in item) || !Array.isArray(item.path)
    || !item.path.every((part) => typeof part === "string")) return false;
  const date = item.kind === "folder" ? item.folder?.created_at
    : item.kind === "file" ? item.file?.created_at
      : item.kind === "template" ? item.document?.updated_at
        : undefined;
  return typeof date === "string" && Number.isFinite(Date.parse(date));
}
