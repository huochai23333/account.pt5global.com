"use client";
import {useCallback, useEffect, useState} from "react";
import type {DocumentArchive, DocumentFolder} from "@/lib/document-library/model";
/** 可选目录来自服务端授权后的数据；搜索只改变显示，不赋予新的保存权限。 */
export function useDocumentDestinations(currentFolderId?: string, enabled = true) {
  const [data, setData] = useState<{archives: DocumentArchive[]; folders: DocumentFolder[]}>({archives: [], folders: []});
  const [folderId, setFolderId] = useState(currentFolderId ?? "");
  const [archiveId, setArchiveId] = useState("");
  const [query, setQuery] = useState("");
  const [confirmShare, setConfirmShare] = useState(false);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(false);
    try {
      const response = await fetch("/api/company-template-documents/destinations", {cache: "no-store", signal});
      const result = await response.json();
      if (!response.ok || !Array.isArray(result.archives) || !Array.isArray(result.folders)) throw new Error("document_failed");
      if (signal?.aborted) return;
      setData(result);
      const current = result.folders.find((folder: DocumentFolder) => folder.id === currentFolderId);
      // 现有位置仍有权限时才预选；新建必须由用户选择人员或客户，不能默认共享。
      setFolderId(current?.id ?? ""); setArchiveId(current?.archive_id ?? ""); setConfirmShare(false);
    } catch { if (!signal?.aborted) setError(true); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [currentFolderId]);
  useEffect(() => {if (!enabled) return; const controller = new AbortController(); void load(controller.signal); return () => controller.abort();}, [load, enabled]);
  const folder = data.folders.find(item => item.id === folderId);
  // 手动保存及另存到共享目录都要确认；自动保存不经过此选择器。
  const sharing = folder?.zone === "shared";
  function selectArchive(id: string) {setArchiveId(id); setFolderId(""); setConfirmShare(false);}
  function selectFolder(id: string) {setFolderId(id); setConfirmShare(false);}
  // 搜索结果可以来自别人的档案；同时更新档案与目录，不能把新目录套在旧档案下。
  function openFolder(id: string) {const target=data.folders.find(item=>item.id===id);if(!target)return;setArchiveId(target.archive_id);setFolderId(id);setQuery("");setConfirmShare(false);}
  return {data, folderId, archiveId, query, setQuery, confirmShare, setConfirmShare, loading, error, load,
    selectArchive, selectFolder, openFolder, sharing, valid: !loading && !error && Boolean(folder) && (!sharing || confirmShare)};
}
export type DestinationController = ReturnType<typeof useDocumentDestinations>;
