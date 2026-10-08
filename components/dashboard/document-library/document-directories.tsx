"use client";
import { useTranslations } from "next-intl";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/form-controls";
import type { DocumentLibrary, DocumentSelection, DocumentFolder } from "@/lib/document-library/model";

export function folderLabel(folder: DocumentFolder, t: (key: string) => string) { return folder.system_key ? t(`zones.${folder.zone}`) : folder.name; }
/** 桌面目录和手机目录选择共用同一份已授权数据，不在前端推算隐藏区域。 */
export function DocumentDirectories({ data, select, disabled }: { data: DocumentLibrary; select: (selection: DocumentSelection) => void; disabled: boolean }) {
  const t = useTranslations("Documents");
  const label = (folder: DocumentFolder) => {
    const parents: string[] = [folderLabel(folder, t)]; let current = folder;
    while (current.parent_id) { const parent = data.folders.find((item) => item.id === current.parent_id); if (!parent) break; parents.unshift(folderLabel(parent, t)); current = parent; }
    return parents.join(" / ");
  };
  const archive = data.archives.find((item) => item.id === data.archiveId);
  const subject = archive?.customer_id ? { customer: archive.customer_id } : { user: archive?.user_id ?? undefined };
  return <aside className="min-w-0 space-y-4">
    <Field label={t("archive")}>
      <Select aria-label={t("archive")} disabled={disabled} value={data.archiveId} options={data.archives.map((item) => ({ value: item.id, label: item.name }))} onValueChange={(value) => {
        const target = data.archives.find((item) => item.id === value); if (target) select(target.customer_id ? { customer: target.customer_id } : { user: target.user_id ?? undefined });
      }} />
    </Field>
    <div className="lg:hidden"><Select aria-label={t("folder")} disabled={disabled} value={data.folderId} options={data.folders.map((folder) => ({ value: folder.id, label: label(folder) }))} onValueChange={(value) => select({ ...subject, folder: value })} /></div>
    <nav aria-label={t("folders")} className="hidden min-w-0 space-y-2 lg:block">
      {data.folders.map((folder) => <Button wrap className="w-full" disabled={disabled} key={folder.id} variant={folder.id === data.folderId ? "primary" : "outline"} onClick={() => select({ ...subject, folder: folder.id })}><FolderOpen className="size-4 shrink-0" aria-hidden />{label(folder)}</Button>)}
    </nav>
  </aside>;
}
