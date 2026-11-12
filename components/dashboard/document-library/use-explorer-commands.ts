"use client";

import { useParams, useRouter } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import type {
  DocumentFolder,
  DocumentSelection,
  ExplorerItem,
  ExplorerTarget,
} from "@/lib/document-library/model";
import { templateDocumentHref } from "@/lib/company-templates/documents/navigation";
import {
  explorerTarget,
  folderSubject,
  itemManageable,
} from "./explorer-helpers";
import type { ExplorerAction } from "./explorer-toolbar";
import type { ExplorerDialogTarget } from "./explorer-dialog";
import type { InlineNaming } from "./use-inline-naming";
import type { useDocumentExplorer } from "./use-document-explorer";
import type { useExplorerSelection } from "./use-explorer-selection";

type ExplorerCommandsOptions = {
  library: ReturnType<typeof useDocumentExplorer>;
  selection: ReturnType<typeof useExplorerSelection>;
  inline: InlineNaming;
  busy: boolean;
  setDialog: Dispatch<SetStateAction<ExplorerDialogTarget | null>>;
};

/** 命令决定打开的位置和确认方式。实际写入仍由单项或批次模块按权限完成。 */
export function useExplorerCommands({
  library,
  selection,
  inline,
  busy,
  setDialog,
}: ExplorerCommandsOptions) {
  const router = useRouter();
  const { workspace } = useParams<{ workspace: string }>();

  function navigate(next: DocumentSelection) {
    if (inline.editing) return;
    selection.clear();
    void library.navigate(next);
  }
  function open(item: ExplorerItem) {
    if (busy) return;
    if (item.kind === "location" || item.kind === "archive")
      navigate(item.selection);
    else if (item.kind === "folder" && library.data)
      navigate({
        ...folderSubject(library.data, item.folder.archive_id),
        scope: "folder",
        folder: item.id,
      });
    else if (item.kind === "template")
      router.push(templateDocumentHref(workspace, item.id));
    else if (item.kind === "file") {
      if (
        item.file.mime_type.startsWith("image/") ||
        item.file.mime_type === "application/pdf"
      )
        setDialog({ action: "preview", items: [], item });
      else {
        const link = document.createElement("a");
        link.href = `/api/document-library/files/${item.id}/content`;
        link.click();
      }
    }
  }
  function move(items: ExplorerTarget[], folder: DocumentFolder) {
    if (!busy && folder.can_manage)
      setDialog({ action: "move", items, destinationId: folder.id });
  }
  function action(
    name: ExplorerAction,
    items = selection.selected,
    contextFolder?: DocumentFolder,
  ) {
    if (busy || inline.editing) return;
    const targets = items
      .map(explorerTarget)
      .filter((item): item is ExplorerTarget => item !== null);
    if (name === "refresh") {
      void library.refresh();
      return;
    }
    if (name === "newDocument") {
      const folder =
        contextFolder?.id ??
        (library.data?.canManage ? library.data.folderId : null);
      router.push(
        `/${workspace}/company-templates${folder ? `?folder=${encodeURIComponent(folder)}` : ""}`,
      );
      return;
    }
    if (name === "open") {
      if (items.length === 1) open(items[0]);
      return;
    }
    if (name === "create") {
      const destination =
        contextFolder ??
        library.data?.folders.find((f) => f.id === library.data?.folderId);
      if (library.data?.canManage && destination?.can_manage) {
        if (destination.id === library.data.folderId)
          void inline.create(destination.id);
        else
          void library
            .navigate({
              ...folderSubject(library.data, destination.archive_id),
              scope: "folder",
              folder: destination.id,
            })
            .then((ok) => {
              if (ok) void inline.create(destination.id);
            });
      }
      return;
    }
    if (name === "paste") {
      if (!library.data?.canManage) return;
      const destination =
        contextFolder ??
        library.data?.folders.find(
          (folder) => folder.id === library.data?.folderId,
        );
      if (destination?.can_manage && selection.cut.length)
        setDialog({
          action: selection.clipboardMode === "copy" ? "copy" : "move",
          items: selection.cut,
          destinationId: destination.id,
        });
      return;
    }
    if (!targets.length || targets.length !== items.length) return;
    if (name === "download") {
      setDialog({
        action: name,
        items: targets,
        item: items.length === 1 ? items[0] : undefined,
      });
      return;
    }
    if (!items.every(itemManageable)) return;
    if (name === "rename") {
      if (items.length === 1) {
        const item = items[0];
        // 目录树可以指向别处；先进入其父目录，再在真实位置编辑，不能把别处的目录插进当前列表。
        if (
          contextFolder &&
          item.kind === "folder" &&
          item.folder.parent_id &&
          item.folder.parent_id !== library.data?.folderId &&
          library.data
        )
          void library
            .navigate({
              ...folderSubject(library.data, item.folder.archive_id),
              scope: "folder",
              folder: item.folder.parent_id,
            })
            .then((ok) => {
              if (ok) inline.start(item);
            });
        else inline.start(item);
      }
      return;
    }
    if (name === "cut") {
      selection.setCut(targets);
      return;
    }
    if (name === "copy") {
      selection.setClipboard("copy", targets);
      return;
    }
    if (name === "duplicate" && items.length !== 1) return;
    if (name === "move" || name === "delete" || name === "duplicate")
      setDialog({
        action: name === "duplicate" ? "copy" : name,
        items: targets,
        item: items.length === 1 ? items[0] : undefined,
      });
  }
  return { navigate, open, move, action };
}
