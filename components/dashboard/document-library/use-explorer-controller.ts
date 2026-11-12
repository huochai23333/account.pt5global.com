"use client";
import { useState, type KeyboardEvent, type DragEvent } from "react";
import type {
  ExplorerLibrary,
  DocumentSelection,
} from "@/lib/document-library/model";
import { useTranslations } from "next-intl";
import { useInlineNaming } from "./use-inline-naming";
import { useDocumentExplorer } from "./use-document-explorer";
import { useExplorerSelection } from "./use-explorer-selection";
import { useExplorerOperations } from "./use-explorer-operations";
import { useExplorerCommands } from "./use-explorer-commands";
import type {
  ExplorerDialogTarget,
  ExplorerDialogSubmission,
} from "./explorer-dialog";
/** 控制器调度独立的数据、选择和操作模块；页面不再承载表单或写入细节。 */
export function useExplorerController(
  initial: ExplorerLibrary | null,
  initialSelection: DocumentSelection,
  userId: string,
) {
  const library = useDocumentExplorer(initial, initialSelection);
  const selection = useExplorerSelection(
    library.data?.items ?? [],
    JSON.stringify(library.selection),
    userId,
  );
  const operations = useExplorerOperations(userId, library.refresh);
  const [view, setView] = useState<"list" | "grid">("list");
  const [dialog, setDialog] = useState<ExplorerDialogTarget | null>(null);
  const [dragging, setDragging] = useState(false);
  const t = useTranslations("Documents");
  const inline = useInlineNaming(
    async (folderId, operationId) => {
      if (
        operations.single.outstanding.some(
          (intent) =>
            intent.action === "create_default_folder" &&
            intent.payload.folderId === folderId,
        )
      )
        throw new Error("unconfirmed");
      return operations.single.write(
        "create_default_folder",
        { folderId, name: t("explorer.defaultFolder") },
        operationId,
      );
    },
    async (item, name, operationId) =>
      operations.submit(
        { action: "rename", items: [], item },
        { name, destinationId: "", manifest: null, operationId },
      ),
    library.refresh,
  );
  const busy = operations.busy || library.loading || inline.saving;
  const { navigate, open, move, action } = useExplorerCommands({
    library,
    selection,
    inline,
    busy,
    setDialog,
  });

  function keyboard(event: KeyboardEvent<HTMLElement>) {
    if (
      busy ||
      dialog ||
      inline.editing ||
      (event.target as HTMLElement).closest(
        'input,textarea,select,button,[contenteditable="true"],[role="combobox"],[role="menu"]',
      )
    )
      return;
    const ctrl = event.ctrlKey || event.metaKey;
    let handled = true;
    if (ctrl && event.shiftKey && event.key.toLowerCase() === "n")
      action("create");
    else if (ctrl && event.key.toLowerCase() === "a") selection.selectAll();
    else if (ctrl && event.key.toLowerCase() === "c") action("copy");
    else if (ctrl && event.key.toLowerCase() === "x") action("cut");
    else if (ctrl && event.key.toLowerCase() === "v") action("paste");
    else if (event.key === "Enter") action("open");
    else if (event.key === "F2") action("rename");
    else if (event.key === "Delete") action("delete");
    else if (event.key === "Escape") selection.clear();
    else handled = false;
    if (handled) event.preventDefault();
  }
  async function reconcile(receipt: { operationId: string }) {
    if (await operations.single.reconcile(receipt))
      inline.recovered(receipt.operationId);
  }
  function dragOver(event: DragEvent) {
    if (
      library.data?.canManage &&
      !busy &&
      event.dataTransfer.types.includes("Files")
    ) {
      event.preventDefault();
      setDragging(true);
    }
  }
  function drop(event: DragEvent) {
    setDragging(false);
    if (library.data?.canManage && !busy && event.dataTransfer.files.length) {
      event.preventDefault();
      void operations.single.upload(
        library.data.folderId!,
        Array.from(event.dataTransfer.files),
      );
    }
  }
  async function submit(value: ExplorerDialogSubmission) {
    if (!dialog) return false;
    const done = await operations.submit(dialog, value);
    if (done && ["move", "delete", "copy"].includes(dialog.action)) {
      selection.clear();
      if (dialog.action === "move") selection.setCut([]);
    }
    return done;
  }
  return {
    library,
    selection,
    operations,
    inline,
    reconcile,
    view,
    setView,
    dialog,
    setDialog,
    busy,
    navigate,
    open,
    move,
    action,
    keyboard,
    dragOver,
    drop,
    dragging,
    setDragging,
    submit,
  };
}
