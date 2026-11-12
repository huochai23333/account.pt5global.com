"use client";
import { useTranslations } from "next-intl";
import { Field, Input } from "@/components/ui/form-controls";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { folderPath } from "@/components/dashboard/document-library/explorer-helpers";
import { folderLabel } from "@/components/dashboard/document-library/folder-label";
import type { DestinationController } from "./use-document-destinations";
import { DocumentFolderBrowser } from "./document-folder-browser";
/** 字段只渲染选择和提示，目录加载和选择状态由独立控制器负责。 */
export function DocumentDestinationFields({
  selection,
  busy,
}: {
  selection: DestinationController;
  busy: boolean;
}) {
  const t = useTranslations("CompanyTemplates.documents");
  const library = useTranslations("Documents");
  const { data, query, archiveId, folderId } = selection;
  const archives = data.archives;
  // 位置选择和文件浏览使用同一套父目录路径规则，只显示已授权的目录。
  const path = (id: string) =>
    folderPath(id, data.folders, (folder) => folderLabel(folder, library));
  return (
    <div className="grid min-w-0 gap-4">
      {selection.loading ? (
        <p role="status">{t("folderLoading")}</p>
      ) : selection.error ? (
        <div role="alert">
          <p>{t("errors.document_failed")}</p>
          <Button onClick={() => void selection.load()}>{t("retry")}</Button>
        </div>
      ) : !data.folders.length ? (
        <p>{t("noFolders")}</p>
      ) : (
        <>
          <Field label={t("archiveSearch")}>
            <Input
              autoFocus
              disabled={busy}
              value={query}
              maxLength={120}
              onChange={(event) => selection.setQuery(event.target.value)}
            />
          </Field>
          <Field label={library("archive")}>
            <Select
              aria-label={library("archive")}
              disabled={busy}
              value={archiveId || null}
              placeholder={t("chooseArchive")}
              options={archives.map((item) => ({ value: item.id, label: item.name }))}
              onValueChange={selection.selectArchive}
            />
          </Field>
          <Field label={library("destination")}>
            <Select
              aria-label={library("destination")}
              disabled={busy || !archiveId}
              value={folderId || null}
              placeholder={t("chooseFolder")}
              options={data.folders
                .filter((item) => item.archive_id === archiveId)
                .map((item) => ({ value: item.id, label: path(item.id) }))}
              onValueChange={selection.selectFolder}
            />
          </Field>
          <DocumentFolderBrowser selection={selection} busy={busy} />
        </>
      )}
    </div>
  );
}
