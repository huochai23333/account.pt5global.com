"use client";
import { useRef, useState } from "react";
import type { DocumentLibrary, DocumentSelection } from "@/lib/document-library/model";

export function documentQuery(selection: DocumentSelection) {
  const params = new URLSearchParams();
  Object.entries(selection).forEach(([key, value]) => { if (value) params.set(key, String(value)); });
  return params;
}
/** 切换档案先清空旧结果；过期的查询响应不能覆盖新档案，地址用于整页刷新恢复。 */
export function useDocumentLibrary(initial: DocumentLibrary | null, initialSelection: DocumentSelection) {
  const [data, setData] = useState(initial);
  const [selection, setSelection] = useState(initialSelection);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initial ? "" : "forbidden");
  const requestNumber = useRef(0);
  async function load(next = selection) {
    const number = ++requestNumber.current;
    setLoading(true); setError(""); setData(null); setSelection(next);
    try {
      const response = await fetch(`/api/document-library?${documentQuery(next)}`, { cache: "no-store", signal: AbortSignal.timeout(30_000) });
      const result = await response.json();
      if (!response.ok || !result.archiveId) throw new Error(result.error ?? "unconfirmed");
      if (number !== requestNumber.current) return false;
      setData(result);
      window.history.replaceState(null, "", `${window.location.pathname}?${documentQuery({ ...next, folder: result.folderId })}`);
      return true;
    } catch (error) { if (number === requestNumber.current) setError(error instanceof Error ? error.message : "unconfirmed"); return false; }
    finally { if (number === requestNumber.current) setLoading(false); }
  }
  return { data, selection, loading, error, load };
}
