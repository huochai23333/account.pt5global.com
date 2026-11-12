"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DocumentArchive, DocumentFolder } from "@/lib/document-library/model";
import { useSaveAsListing } from "./use-save-as-listing";

type SaveAsDestinations = {
  archives: DocumentArchive[];
  folders: DocumentFolder[];
  userId: string;
};

/** 这里保存目录、导航和选择；文件查询交给列表 Hook，切换目录时只更新右侧。 */
export function useSaveAsBrowser(initialFolderId?: string) {
  const [data, setData] = useState<SaveAsDestinations>({ archives: [], folders: [], userId: "" });
  const [history, setHistory] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [directoryError, setDirectoryError] = useState(false);
  const initialized = useRef(false);
  const folderId = history[index] ?? "";
  const folder = data.folders.find((f) => f.id === folderId);
  const [selected, setSelected] = useState("");
  const listing = useSaveAsListing(folder?.id ?? "", query, page);
  const loadDirectories = useCallback(
    async (signal?: AbortSignal): Promise<SaveAsDestinations | null> => {
      setDirectoryLoading(true);
      try {
        const timeout = AbortSignal.timeout(30_000);
        const response = await fetch("/api/company-template-documents/destinations", {
          cache: "no-store",
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        const result = await response.json();
        if (!response.ok || !Array.isArray(result?.folders)
          || !Array.isArray(result.archives) || typeof result.userId !== "string") {
          throw new Error("document_failed");
        }
        if (signal?.aborted) return null;
        setData(result);
        setDirectoryError(false);
        if (!initialized.current) {
          const first =
            result.folders.find((f: DocumentFolder) => f.id === initialFolderId) ??
            result.folders.find(
              (f: DocumentFolder) =>
                f.system_key &&
                result.archives.some(
                  (a: DocumentArchive) => a.id === f.archive_id && a.user_id === result.userId,
                ),
            );
          initialized.current = true;
          if (first) setHistory([first.id]);
        }
        return result;
      } catch {
        if (!signal?.aborted) setDirectoryError(true);
        return null;
      } finally {
        if (!signal?.aborted) setDirectoryLoading(false);
      }
    },
    [initialFolderId],
  );
  useEffect(() => {
    const controller = new AbortController();
    void loadDirectories(controller.signal);
    return () => controller.abort();
  }, [loadDirectories]);
  function navigate(id: string) {
    if (id === folderId) return;
    listing.refresh();
    setHistory([...history.slice(0, index + 1), id]);
    setIndex(index + 1);
    setQuery("");
    setPage(1);
    setSelected("");
  }
  function traverse(next: number) {
    listing.refresh();
    setIndex(next);
    setQuery("");
    setPage(1);
    setSelected("");
  }
  return {
    data,
    folder,
    folderId,
    ...listing,
    loading: directoryLoading || listing.loading,
    directoryLoading,
    directoryError,
    selected,
    setSelected,
    query,
    setQuery: (value: string) => {
      listing.refresh();
      setQuery(value);
      setPage(1);
      setSelected("");
    },
    page,
    setPage: (value: number) => {
      listing.refresh();
      setPage(value);
      setSelected("");
    },
    navigate,
    back: () => traverse(index - 1),
    forward: () => traverse(index + 1),
    canBack: index > 0,
    canForward: index < history.length - 1,
    up: () => {
      if (folder?.parent_id) navigate(folder.parent_id);
    },
    loadDirectories,
  };
}
export type SaveAsBrowser = ReturnType<typeof useSaveAsBrowser>;
