"use client";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import { Input, Field, ChoiceField } from "@/components/ui/form-controls";
import type {
  DocumentManifest,
  ExplorerTarget,
  ExplorerItem,
  DocumentFolder,
} from "@/lib/document-library/model";
import { useDocumentDestinations } from "@/components/dashboard/company-templates/documents/use-document-destinations";
import { DocumentDestinationFields } from "@/components/dashboard/company-templates/documents/document-destination-fields";
import { ExplorerPreviewDialog } from "./explorer-preview-dialog";
import { useExplorerManifest } from "./use-explorer-manifest";

export type ExplorerDialogTarget = {
  action: "rename" | "move" | "delete" | "copy" | "preview" | "download";
  items: ExplorerTarget[];
  item?: ExplorerItem;
  folder?: DocumentFolder;
  destinationId?: string;
};
export type ExplorerDialogSubmission = {
  name: string;
  destinationId: string;
  manifest: DocumentManifest | null;
  operationId: string;
};
type ExplorerDialogProps = {
  target: ExplorerDialogTarget;
  busy: boolean;
  close: () => void;
  submit: (value: ExplorerDialogSubmission) => Promise<boolean>;
};

export function ExplorerDialog(props: ExplorerDialogProps) {
  const { target, close } = props;
  if (target.action === "preview" && target.item?.kind === "file") {
    return <ExplorerPreviewDialog file={target.item.file} close={close} />;
  }
  return <ExplorerOperationDialog {...props} />;
}

/** 确认窗组装名称、目的地和提交状态，失败时保留原输入和原操作编号。 */
function ExplorerOperationDialog({
  target,
  busy,
  close,
  submit,
}: ExplorerDialogProps) {
  const t = useTranslations("Documents");
  const op = useRef<string>(crypto.randomUUID());
  const [name, setName] = useState(target.item?.name ?? "");
  const [notice, setNotice] = useState(false);
  const sourceFolder =
    target.item?.kind === "file"
      ? target.item.file.folder_id
      : target.item?.kind === "template"
        ? target.item.document.folder_id
        : target.item?.kind === "folder"
          ? (target.item.folder.parent_id ?? undefined)
          : undefined;
  // 默认展开来源档案；剪切粘贴和拖放则以用户刚进入的目的地为准。
  const needsDestination = target.action === "move" || target.action === "copy";
  const dest = useDocumentDestinations(
    target.destinationId ?? sourceFolder,
    needsDestination,
  );
  const [destinationId, setDestinationId] = useState(
    target.destinationId ?? sourceFolder ?? "",
  );
  const destination = dest.data.folders.find((f) => f.id === destinationId);
  const { manifest, loading, error, setError, loadManifest } =
    useExplorerManifest(target, setName, setNotice);
  const counts = {
    folders: manifest?.entries.filter((e) => e.kind === "folder").length ?? 0,
    files: manifest?.entries.filter((e) => e.kind === "file").length ?? 0,
    templates:
      manifest?.entries.filter((e) => e.kind === "template").length ?? 0,
  };
  const forbiddenFolders = new Set(
    manifest?.entries.filter((e) => e.kind === "folder").map((e) => e.id),
  );
  const destinations = dest.data.folders.filter(
    (f) => !forbiddenFolders.has(f.id),
  );
  const destinationValid =
    Boolean(destination) &&
    !forbiddenFolders.has(destinationId) &&
    !(
      target.action === "move" &&
      manifest?.entries.some(
        (e) =>
          e.path.length === 1 &&
          (e.kind === "folder"
            ? e.record.parent_id === destinationId
            : e.folderId === destinationId),
      )
    );
  const needsName = target.action === "copy" && target.items.length === 1;
  const valid =
    !loading &&
    !busy &&
    (!["move", "delete", "download", "copy"].includes(target.action) ||
      Boolean(manifest)) &&
    (!needsDestination || destinationValid) &&
    (!needsName || Boolean(name.trim())) &&
    (target.action !== "delete" || notice) &&
    (target.action !== "download" || counts.files > 0 || counts.folders > 0);
  return (
    <DashboardDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) close();
      }}
      title={t(`explorer.${target.action}`)}
      actions={
        <>
          <Button variant="outline" disabled={busy} onClick={close}>
            {t("cancel")}
          </Button>
          <Button
            disabled={!valid}
            onClick={async () => {
              setError("");
              try {
                if (
                  await submit({
                    name,
                    destinationId,
                    manifest,
                    operationId: op.current,
                  })
                )
                  close();
              } catch (cause) {
                const message =
                  cause instanceof Error ? cause.message : "unconfirmed";
                setError(
                  message.startsWith("document_")
                    ? message.replace("document_", "")
                    : message,
                );
              }
            }}
          >
            {busy ? t("working") : t("confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {loading && <p role="status">{t("loading")}</p>}
        {needsName && (
          <Field label={t("name")}>
            <Input
              autoFocus
              maxLength={
                target.item?.kind === "template" ||
                manifest?.entries.find((entry) => entry.path.length === 1)
                  ?.kind === "template"
                  ? 120
                  : 200
              }
              disabled={busy || loading}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
        )}
        {manifest && (
          <>
            <p>{t("explorer.manifestCounts", counts)}</p>
            <ul className="max-h-48 overflow-auto rounded-lg border border-border-subtle p-3 text-sm">
              {manifest.entries
                .filter((e) => e.path.length === 1)
                .map((e) => (
                  <li
                    className="break-words [overflow-wrap:anywhere]"
                    key={`${e.kind}:${e.id}`}
                  >
                    {e.location
                      ? `${e.location.archiveName} / ${e.location.folders.map((f) => (f.system_key ? t(`zones.${f.zone}`) : f.name)).join(" / ")}${e.kind === "folder" ? "" : ` / ${e.record.name}`}`
                      : e.path.join(" / ")}
                  </li>
                ))}
            </ul>
          </>
        )}
        {target.action === "delete" && (
          <ChoiceField
            type="checkbox"
            disabled={busy}
            checked={notice}
            onChange={(event) => setNotice(event.target.checked)}
            label={t("explorer.permanentDelete")}
          />
        )}
        {needsDestination && (
          <DocumentDestinationFields
            busy={busy}
            selection={{
              ...dest,
              data: { ...dest.data, folders: destinations },
              folderId: destinationId,
              archiveId: dest.archiveId || destination?.archive_id || "",
              valid: destinationValid,
              selectArchive: (id) => {
                dest.selectArchive(id);
                setDestinationId("");
              },
              selectFolder: (id) => {
                dest.selectFolder(id);
                setDestinationId(id);
              },
              openFolder: (id) => {
                dest.openFolder(id);
                setDestinationId(id);
              },
            }}
          />
        )}
        {target.action === "download" && counts.templates > 0 && (
          <p>
            {t("explorer.templateDownloadNotice", { count: counts.templates })}
          </p>
        )}
        {target.action === "download" && (
          <p className="text-sm text-content-muted">
            {t("explorer.zipLimits")}
          </p>
        )}
        {error && (
          <div role="alert">
            <p className="text-status-danger">
              {t(
                `errors.${["folderNameConflict", "forbidden", "invalid", "size", "archiveSize", "templateDownload", "busy", "conflict", "folderNotEmpty", "defaultFolder", "partial", "unconfirmed"].includes(error) ? error : "unconfirmed"}`,
              )}
            </p>
            {["move", "delete", "download", "copy"].includes(target.action) && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => void loadManifest()}
              >
                {t("explorer.reloadManifest")}
              </Button>
            )}
          </div>
        )}
      </div>
    </DashboardDialog>
  );
}
