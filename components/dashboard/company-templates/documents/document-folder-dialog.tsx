"use client";
import {useState} from "react";
import {useTranslations} from "next-intl";
import {DashboardDialog} from "@/components/dashboard/dashboard-dialog";
import {Button} from "@/components/ui/button";
import {Field, Input} from "@/components/ui/form-controls";
import {useDocumentDestinations} from "./use-document-destinations";
import {DocumentDestinationFields} from "./document-destination-fields";
export type FolderSaveChoice = {folderId: string; confirmShare: boolean; name?: string};
/** 创建、保存、另存和移动共用位置表单；失败不卸载弹窗，保留用户选择。 */
export function DocumentFolderDialog({title, currentFolderId, initialName, busy, error, close, submit}: {
  title: string; currentFolderId?: string; initialName?: string; busy: boolean; error: string;
  close: () => void; submit: (choice: FolderSaveChoice) => Promise<unknown>;
}) {
  const t = useTranslations("CompanyTemplates.documents"); const selection = useDocumentDestinations(currentFolderId);
  const [name, setName] = useState(initialName ?? "");
  return <DashboardDialog open title={title} onOpenChange={open => {if (!open && !busy) close();}}
    actions={<><Button variant="outline" disabled={busy} onClick={close}>{t("cancel")}</Button><Button disabled={busy || !selection.valid || (initialName !== undefined && !name.trim())} loading={busy} onClick={() => void submit({folderId: selection.folderId, confirmShare: selection.confirmShare, ...(initialName !== undefined ? {name: name.trim()} : {})})}>{t("confirm")}</Button></>}>
    <div className="grid gap-4">
      {initialName !== undefined ? <Field label={t("name")}><Input disabled={busy} value={name} maxLength={120} onChange={event => setName(event.target.value)}/></Field> : null}
      <DocumentDestinationFields selection={selection} busy={busy}/>
      {error ? <p role="alert" className="break-words text-sm text-status-danger">{t(`errors.${error}`)}</p> : null}
    </div>
  </DashboardDialog>;
}
