"use client";
import {useTranslations} from "next-intl";
import {Field, Input, ChoiceField} from "@/components/ui/form-controls";
import {Select} from "@/components/ui/select";
import {Button} from "@/components/ui/button";
import {folderLabel} from "@/components/dashboard/document-library/document-directories";
import type {DocumentFolder} from "@/lib/document-library/model";
import type {DestinationController} from "./use-document-destinations";
/** 字段只渲染选择和提示，目录加载及共享确认状态由独立控制器负责。 */
export function DocumentDestinationFields({selection, busy}: {selection: DestinationController; busy: boolean}) {
  const t = useTranslations("CompanyTemplates.documents"); const library = useTranslations("Documents");
  const {data, query, archiveId, folderId} = selection;
  const archives = data.archives.filter(item => item.id === archiveId || item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  function path(folder: DocumentFolder) {
    const names = [folderLabel(folder, library)]; const visited = new Set([folder.id]); let parentId = folder.parent_id;
    while (parentId && !visited.has(parentId)) {
      visited.add(parentId); const parent = data.folders.find(item => item.id === parentId); if (!parent) break;
      names.unshift(folderLabel(parent, library)); parentId = parent.parent_id;
    }
    return names.join(" / ");
  }
  return <div className="grid min-w-0 gap-4">
    {selection.loading ? <p role="status">{t("folderLoading")}</p> : selection.error ? <div role="alert"><p>{t("errors.document_failed")}</p><Button onClick={() => void selection.load()}>{t("retry")}</Button></div> : !data.folders.length ? <p>{t("noFolders")}</p> : <>
      <Field label={t("archiveSearch")}><Input autoFocus disabled={busy} value={query} maxLength={120} onChange={event => selection.setQuery(event.target.value)}/></Field>
      <Field label={library("archive")}><Select aria-label={library("archive")} disabled={busy} value={archiveId || null} placeholder={t("chooseArchive")} options={archives.map(item => ({value: item.id, label: item.name}))} onValueChange={selection.selectArchive}/></Field>
      <Field label={library("destination")}><Select aria-label={library("destination")} disabled={busy || !archiveId} value={folderId || null} placeholder={t("chooseFolder")} options={data.folders.filter(item => item.archive_id === archiveId).map(item => ({value: item.id, label: path(item)}))} onValueChange={selection.selectFolder}/></Field>
      {selection.sharing ? <ChoiceField type="checkbox" label={t("shareNotice")} disabled={busy} checked={selection.confirmShare} onChange={event => selection.setConfirmShare(event.target.checked)}/> : null}
    </>}
  </div>;
}
