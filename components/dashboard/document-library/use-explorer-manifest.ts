"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentManifest } from "@/lib/document-library/model";
import type { ExplorerDialogTarget } from "./explorer-dialog";

const manifestActions: ExplorerDialogTarget["action"][] = [
  "move",
  "delete",
  "download",
  "copy",
];

/** 清单随确认窗加载。关闭后取消旧请求，重新读取也会清掉上一次的删除确认。 */
export function useExplorerManifest(
  target: ExplorerDialogTarget,
  setName: (name: string) => void,
  setNotice: (notice: boolean) => void,
) {
  const [manifest, setManifest] = useState<DocumentManifest | null>(null);
  const [loading, setLoading] = useState(
    manifestActions.includes(target.action),
  );
  const [error, setError] = useState("");
  const request = useRef<AbortController | null>(null);
  const loadManifest = useCallback(async () => {
    if (!manifestActions.includes(target.action)) return;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const { signal } = controller;
    setLoading(true);
    setManifest(null);
    setError("");
    setNotice(false);
    try {
      const response = await fetch("/api/document-library/manifest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: target.items,
          write: target.action !== "download",
        }),
        signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result?.error ?? "unconfirmed");
      if (!result?.digest || !Array.isArray(result.entries))
        throw new Error("unconfirmed");
      if (!signal.aborted) {
        if (target.action === "copy" && target.items.length === 1) {
          const root = (result.entries as DocumentManifest["entries"]).find(
            (entry) => entry.path.length === 1,
          );
          if (!root) throw new Error("unconfirmed");
          const original = root.record.name;
          const extension =
            root.kind === "file"
              ? (original.match(/\.[a-zA-Z0-9]{1,10}$/)?.[0] ?? "")
              : "";
          setName(
            `${extension ? original.slice(0, -extension.length) : original} (2)${extension}`,
          );
        }
        setManifest(result);
      }
    } catch (cause) {
      if (!signal.aborted)
        setError(cause instanceof Error ? cause.message : "unconfirmed");
    } finally {
      if (!signal.aborted) setLoading(false);
    }
  }, [target, setName, setNotice]);
  useEffect(() => {
    void loadManifest();
    return () => request.current?.abort();
  }, [loadManifest]);
  return { manifest, loading, error, setError, loadManifest };
}
