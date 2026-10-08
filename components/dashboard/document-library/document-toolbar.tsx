"use client";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import type { DocumentFolder } from "@/lib/document-library/model";
import type { DocumentDialogTarget } from "./document-dialogs";
import { DOCUMENT_ACCEPT } from "@/lib/document-library/browser-policy";
import { DashboardFilePicker } from "@/components/dashboard/dashboard-framework-primitives";
import { folderLabel } from "./document-directories";

/** 搜索和上传入口只发出意图；文件选择使用全站统一组件。 */
export function DocumentToolbar({ folder, canManage, busy, query, search, open, upload }: { folder: DocumentFolder; canManage: boolean; busy: boolean; query: string; search: (value: string) => void; open: (target: DocumentDialogTarget) => void; upload: (files: File[]) => void }) {
  const t = useTranslations("Documents");
  return <div className="min-w-0 space-y-4">
    <h2 className="break-words text-xl font-semibold [overflow-wrap:anywhere]">{folderLabel(folder, t)}</h2>
    <form className="flex min-w-0 flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); search(String(new FormData(event.currentTarget).get("query") ?? "")); }}>
      <Input className="min-w-0 flex-1 basis-40" name="query" aria-label={t("search")} key={query} defaultValue={query} maxLength={200} />
      <Button variant="outline" disabled={busy} type="submit">{t("search")}</Button>
    </form>
    {canManage && <div className="flex flex-wrap gap-2">
      <DashboardFilePicker accept={DOCUMENT_ACCEPT} multiple disabled={busy} label={t("upload")} onFiles={upload} />
      <Button variant="outline" disabled={busy} onClick={() => open({ action: "create_folder", folder })}>{t("create_folder")}</Button>
      {!folder.system_key && <>{(["rename_folder", "delete_folder"] as const).map((action) => <Button variant="outline" disabled={busy} key={action} onClick={() => open({ action, folder })}>{t(action)}</Button>)}</>}
    </div>}
    <p className="text-sm text-content-muted">{canManage ? t("limits") : t("readOnly")}</p>
  </div>;
}
