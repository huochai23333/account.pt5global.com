"use client";

import { Download, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { DashboardFilePicker } from "@/components/dashboard/dashboard-framework-primitives";
import { Button } from "@/components/ui/button";
import {
  createCustomerInventoryAttachmentDownloadUrl,
  deleteCustomerInventoryAttachment,
} from "@/lib/customer-inventory-attachments";
import type {
  CustomerInventoryAttachment,
  CustomerInventoryOrder,
} from "@/lib/customer-inventory-types";

import { formatInventoryDateTime } from "./customer-inventory-display";
import { useInventoryAttachmentUpload } from "./use-inventory-attachment-upload";
import type { RunInventoryAction } from "./use-customer-inventory-actions";

export function CustomerInventoryAttachmentsDialog({
  attachments,
  canWrite,
  currentUserId,
  onClose,
  order,
  pendingKey,
  runAction,
}: {
  attachments: CustomerInventoryAttachment[];
  canWrite: boolean;
  currentUserId: string | null;
  onClose: () => void;
  order: CustomerInventoryOrder | null;
  pendingKey: string | null;
  runAction: RunInventoryAction;
}) {
  const t = useTranslations("CustomerInventory");
  const upload = useInventoryAttachmentUpload({
    attachments,
    orderId: order?.id,
    currentUserId,
    runAction,
    successMessage: t("feedback.uploadSuccess"),
  });

  if (!order) return null;
  const uploading = pendingKey === upload.key;

  async function downloadAttachment(attachment: CustomerInventoryAttachment) {
    await runAction(
      `attachment-download:${attachment.id}`,
      t("feedback.downloadReady"),
      async (supabase) => {
        const url = await createCustomerInventoryAttachmentDownloadUrl(
          supabase,
          attachment,
        );
        window.location.assign(url);
      },
    );
  }

  async function removeAttachment(attachment: CustomerInventoryAttachment) {
    await runAction(
      `attachment-delete:${attachment.id}`,
      t("feedback.deleteAttachmentSuccess"),
      async (supabase) => {
        await deleteCustomerInventoryAttachment(supabase, attachment);
      },
    );
  }

  return (
    <DashboardDialog
      actions={
        <Button onClick={onClose} type="button" variant="secondary">
          {t("common.close")}
        </Button>
      }
      description={t("attachments.description")}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      open
      title={t("attachments.title", { number: order.order_number })}
    >
      <div className="grid min-w-0 gap-5">
        {canWrite ? (
          <div className="grid gap-3 rounded-record-card border border-border-subtle bg-surface-inset p-4">
            <DashboardFilePicker
              accept=".csv,.xls,.xlsx"
              disabled={uploading || upload.needsCheck}
              files={upload.files}
              label={t("attachments.choose")}
              multiple
              onFiles={upload.selectFiles}
            />
            <p className="text-xs leading-5 text-content-muted">
              {t("attachments.rules")}
            </p>
            {upload.needsCheck && (
              <p role="status" className="text-sm text-content-muted">
                {t("attachments.uploadUnconfirmed")}
              </p>
            )}
            <Button
              className="w-full sm:w-fit"
              disabled={!currentUserId || (!upload.needsCheck && upload.files.length === 0)}
              loading={uploading}
              onClick={() => void upload.submit()}
              type="button"
            >
              {t(upload.needsCheck ? "attachments.checkUpload" : "attachments.upload")}
            </Button>
          </div>
        ) : null}

        {attachments.length === 0 ? (
          <p className="rounded-record-card border border-dashed border-border p-5 text-sm text-content-muted">
            {t("attachments.empty")}
          </p>
        ) : (
          <ul className="grid gap-3">
            {attachments.map((attachment) => (
              <li
                className="flex min-w-0 flex-col gap-3 rounded-record-card border border-border-subtle bg-surface-interactive p-4 sm:flex-row sm:items-center"
                key={attachment.id}
              >
                <div className="min-w-0 flex-1">
                  <p className="break-all font-semibold text-content-strong">
                    {attachment.original_name}
                  </p>
                  <p className="mt-1 text-xs text-content-muted">
                    {t("attachments.fileMeta", {
                      size: formatFileSize(attachment.file_size_bytes),
                      time: formatInventoryDateTime(attachment.created_at),
                    })}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={
                      pendingKey === `attachment-download:${attachment.id}`
                    }
                    loading={pendingKey === `attachment-download:${attachment.id}`}
                    onClick={() => void downloadAttachment(attachment)}
                    type="button"
                    variant="outline"
                  >
                    <Download className="size-4" />
                    {t("attachments.download")}
                  </Button>
                  {canWrite ? (
                    <Button
                      disabled={
                        pendingKey === `attachment-delete:${attachment.id}`
                      }
                      loading={pendingKey === `attachment-delete:${attachment.id}`}
                      onClick={() => void removeAttachment(attachment)}
                      type="button"
                      variant="danger"
                    >
                      <Trash2 className="size-4" />
                      {t("attachments.delete")}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardDialog>
  );
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
