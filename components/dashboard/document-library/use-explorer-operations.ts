"use client";
import { useRef, useState } from "react";
import { downloadExplorerArchive } from "@/lib/document-library/download-client";
import { useDocumentActions } from "./use-document-actions";
import { useExplorerBatches } from "./use-explorer-batches";
import type { ExplorerDialogTarget, ExplorerDialogSubmission } from "./explorer-dialog";
import { writeDocument } from "@/lib/company-templates/documents/client";
/** 单项写入复用原凭证链，批量写入使用持久化清单；两种方式都在完成后刷新真实位置。 */
export function useExplorerOperations(
  userId: string,
  refresh: () => Promise<boolean>,
) {
  const single = useDocumentActions(userId, refresh);
  const batches = useExplorerBatches(userId, refresh);
  const [downloading, setDownloading] = useState(false);
  const downloadInProgress = useRef(false);
  const [downloadError, setDownloadError] = useState("");
  async function submit(target: ExplorerDialogTarget, value: ExplorerDialogSubmission) {
    const { name, destinationId, manifest, operationId } = value;
    const item = target.item;
    if (target.action === "move" || target.action === "delete" || target.action === "copy") {
      if (!manifest) throw new Error("unconfirmed");
      const done = await batches.start(
        target.action,
        target.items,
        manifest,
        destinationId,
        operationId,
        name,
      );
      if (!done) throw new Error(batches.getError() || "unconfirmed");
      return true;
    }
    if (target.action === "rename" && item?.kind === "folder")
      return Boolean(
        await single.write(
          "rename_folder",
          { folderId: item.id, version: item.folder.version, name },
          operationId,
        ),
      );
    if (target.action === "rename" && item?.kind === "file")
      return Boolean(
        await single.write(
          "rename_file",
          { fileId: item.id, version: item.file.version, name },
          operationId,
        ),
      );
    if (item?.kind === "template" && target.action === "rename") {
      single.clearFeedback();
      await writeDocument({
        action: "rename",
        operationId,
        documentId: item.id,
        expectedRevision: item.document.revision,
        name,
      });
      if (!(await refresh())) throw new Error("unconfirmed");
      return true;
    }
    if (target.action === "download") {
      // 连续点击可能早于按钮重渲染，先锁定同一份压缩包的下载。
      if (downloadInProgress.current) return false;
      downloadInProgress.current = true;
      setDownloading(true);
      setDownloadError("");
      try {
        await downloadExplorerArchive(target.items);
        return true;
      } catch (cause) {
        const error = cause instanceof Error ? cause.message : "unconfirmed";
        setDownloadError(error);
        throw cause;
      } finally {
        downloadInProgress.current = false;
        setDownloading(false);
      }
    }
    return false;
  }
  return {
    single,
    batches,
    submit,
    busy: single.busy || batches.busy || downloading,
    error: downloadError || batches.error,
  };
}
