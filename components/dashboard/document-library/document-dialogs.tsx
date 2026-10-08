"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import { Input, Field, ChoiceField } from "@/components/ui/form-controls";
import { Select } from "@/components/ui/select";
import type { DocumentFile, DocumentFolder } from "@/lib/document-library/model";
import { folderLabel } from "./document-directories";

export type DocumentDialogTarget = { action: "create_folder" | "rename_folder" | "delete_folder" | "rename_file" | "move_file" | "delete_file" | "preview"; file?: DocumentFile; folder?: DocumentFolder };
/** 弹窗保存失败时保持表单；移动至共享区须由用户明确勾选确认。 */
export function DocumentDialogs({ target, folders, busy, close, submit, error }: { target: DocumentDialogTarget; folders: DocumentFolder[]; busy: boolean; close: () => void; submit: (payload: Record<string, unknown>) => Promise<boolean>; error: string }) {
  const t = useTranslations("Documents");
  const [name, setName] = useState(target.file?.name ?? (target.folder?.system_key ? "" : target.folder?.name) ?? "");
  const destinations = folders.filter((folder) => folder.can_manage && folder.id !== target.file?.folder_id);
  const [destinationId, setDestinationId] = useState(destinations[0]?.id ?? "");
  const [confirmShare, setConfirmShare] = useState(false);
  const destination = folders.find((folder) => folder.id === destinationId);
  const source = folders.find((folder) => folder.id === target.file?.folder_id);
  const sharing = target.action === "move_file" && destination?.zone === "shared" && source?.zone !== "shared";
  const deleting = target.action.startsWith("delete_");
  const preview = target.action === "preview";
  return <DashboardDialog open onOpenChange={(open) => { if (!open && !busy) close(); }} title={t(target.action)}
    actions={<><Button variant="outline" disabled={busy} onClick={close}>{t("cancel")}</Button>{!preview && <Button disabled={busy || (sharing && !confirmShare) || (target.action === "move_file" && !destinationId)} onClick={async () => {
      const payload = target.file ? { fileId: target.file.id, version: target.file.version, name, destinationId, confirmShare } : { folderId: target.folder?.id, version: target.folder?.version, name };
      if (await submit(payload)) close();
    }}>{busy ? t("working") : t("confirm")}</Button>}</>}>
    {preview && target.file ? <iframe title={target.file.name} className="h-[65vh] w-full rounded-lg border" src={`/api/document-library/files/${target.file.id}/content?preview=1`} /> : deleting ? <p className="break-words [overflow-wrap:anywhere]">{t("deleteWarning", { name })}</p> : target.action === "move_file" ? <div className="space-y-4">
      <Select aria-label={t("destination")} value={destinationId} disabled={busy} options={destinations.map((folder) => ({ value: folder.id, label: folderLabel(folder, t) }))} onValueChange={(value) => { setDestinationId(value); setConfirmShare(false); }} />
      {sharing && <ChoiceField type="checkbox" label={t("shareWarning")} checked={confirmShare} onChange={(event) => setConfirmShare(event.target.checked)} />}
    </div> : <Field label={t("name")}><Input autoFocus aria-label={t("name")} disabled={busy} maxLength={200} value={name} onChange={(event) => setName(event.target.value)} /></Field>}
    {error && !preview && <p role="alert" className="mt-3 text-status-danger">{t(`errors.${error}`)}</p>}
  </DashboardDialog>;
}
