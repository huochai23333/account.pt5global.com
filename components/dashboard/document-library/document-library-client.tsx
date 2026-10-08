"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { DocumentLibrary, DocumentSelection } from "@/lib/document-library/model";
import { DocumentDirectories } from "./document-directories";
import { DocumentFiles } from "./document-files";
import { DocumentDialogs, type DocumentDialogTarget } from "./document-dialogs";
import { DocumentToolbar } from "./document-toolbar";
import { useDocumentLibrary } from "./use-document-library";
import { useDocumentActions } from "./use-document-actions";
import { DocumentPendingOperations } from "./document-pending-operations";
import { DocumentUploadResults } from "./document-upload-results";

/** 页面仅组装资料区和调度操作；数据读取、写入、表单和文件渲染独立维护。 */
export function DocumentLibraryClient({ initial, selection, userId }: { initial: DocumentLibrary | null; selection: DocumentSelection; userId: string }) {
  const t = useTranslations("Documents");
  const library = useDocumentLibrary(initial, selection);
  const actions = useDocumentActions(userId, () => library.load());
  const [dialog, setDialog] = useState<DocumentDialogTarget | null>(null);
  const data = library.data;
  const folder = data?.folders.find((item) => item.id === data.folderId);
  return <section className="min-w-0 space-y-6 p-4 sm:p-6">
    <h1 className="text-2xl font-bold">{t("title")}</h1>
    {actions.message && <p role="status" data-document-result={actions.successful ? "succeeded" : actions.message === "partial" ? "partial_failed" : "failed"} className={actions.successful ? "text-status-success" : "text-status-danger"}>{t(`errors.${actions.message}`)}</p>}
    {library.error && <div role="alert" className="space-y-3"><p>{t(library.error === "forbidden" ? "errors.forbidden" : "errors.unconfirmed")}</p><Button onClick={() => void library.load({})}>{t("myDocuments")}</Button></div>}
    {library.loading && <p role="status">{t("loading")}</p>}
    <DocumentUploadResults results={actions.uploadResults} />
    {data && folder && <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <DocumentDirectories data={data} disabled={actions.busy} select={(next) => void library.load(next)} />
      <div className="min-w-0 space-y-5">
        <DocumentToolbar key={folder.id} folder={folder} canManage={data.canManage} busy={actions.busy} query={library.selection.query ?? ""} search={(query) => void library.load({ ...library.selection, query, page: 1 })} open={setDialog} upload={(files) => void actions.upload(folder.id, files)} />
        <DocumentFiles files={data.files} canManage={data.canManage} busy={actions.busy} onAction={(action, file) => setDialog({ action, file })} />
        <div className="flex flex-wrap items-center gap-3"><Button variant="outline" disabled={actions.busy || (library.selection.page ?? 1) <= 1} onClick={() => void library.load({ ...library.selection, page: (library.selection.page ?? 1) - 1 })}>{t("previous")}</Button><span>{t("pagination", { page: library.selection.page ?? 1, total: data.total })}</span><Button variant="outline" disabled={actions.busy || (library.selection.page ?? 1) * 20 >= data.total} onClick={() => void library.load({ ...library.selection, page: (library.selection.page ?? 1) + 1 })}>{t("next")}</Button></div>
        <DocumentPendingOperations receipts={data.operations} intents={actions.outstanding} busy={actions.busy} reconcile={(receipt) => void actions.reconcile(receipt)} />
      </div>
    </div>}
    {dialog && <DocumentDialogs key={`${dialog.action}:${dialog.file?.id ?? dialog.folder?.id}`} target={dialog} folders={data?.folders ?? initial?.folders ?? []} busy={actions.busy} close={() => setDialog(null)} error={actions.successful ? "" : actions.message} submit={(payload) => actions.command(dialog.action, payload,
      // 当前空目录删除后读取父目录，不能继续请求已删除的目录编号。
      dialog.action === "delete_folder" ? () => library.load({ ...library.selection, folder: dialog.folder?.parent_id ?? undefined, query: undefined, page: 1 }) : undefined)} />}
  </section>;
}
