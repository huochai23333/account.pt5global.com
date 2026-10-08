"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import type { DocumentFile } from "@/lib/document-library/model";

export type FileDialogAction = "rename_file" | "move_file" | "delete_file" | "preview";
/** 列表只展示文件和发出用户意图，写入、权限和弹窗状态由独立模块处理。 */
export function DocumentFiles({ files, canManage, busy, onAction }: { files: DocumentFile[]; canManage: boolean; busy: boolean; onAction: (action: FileDialogAction, file: DocumentFile) => void }) {
  const t = useTranslations("Documents");
  if (!files.length) return <p className="rounded-record-card border border-border-subtle p-6 text-content-muted">{t("empty")}</p>;
  return <div role="list" className="grid min-w-0 gap-3">
    {files.map((file) => <article role="listitem" className="min-w-0 space-y-3 rounded-record-card border border-border-subtle bg-surface-interactive p-4 lg:flex lg:items-center lg:gap-4 lg:space-y-0" data-document-file={file.id} key={file.id}>
      <div className="min-w-0 flex-1 space-y-2">
      <p className="break-words font-semibold [overflow-wrap:anywhere]">{file.name}</p>
      <p className="text-sm text-content-muted">{t("fileSize", { size: (file.size_bytes / 1024).toFixed(1) })}</p>
      </div>
      <div className="flex flex-wrap gap-2 lg:max-w-[65%]">
        <a className="inline-flex min-h-11 items-center rounded-lg border border-border-subtle px-3 text-sm" href={`/api/document-library/files/${file.id}/content`}>{t("download")}</a>
        {(file.mime_type.startsWith("image/") || file.mime_type === "application/pdf") && <Button size="compact" variant="outline" disabled={busy} onClick={() => onAction("preview", file)}>{t("preview")}</Button>}
        {canManage && <>{(["rename_file", "move_file", "delete_file"] as const).map((action) => <Button size="compact" variant="outline" key={action} disabled={busy} onClick={() => onAction(action, file)}>{t(action)}</Button>)}</>}
      </div>
    </article>)}
  </div>;
}
