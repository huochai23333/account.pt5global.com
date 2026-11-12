"use client";

import { FileSpreadsheet, LoaderCircle, Trash2, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { useDashboardConfirm } from "@/components/dashboard/dashboard-confirm-provider";
import { DashboardFilePicker } from "@/components/dashboard/dashboard-framework-primitives";
import { Button } from "@/components/ui/button";
import type { WholesaleOrderListAttachment } from "@/lib/wholesale-order-list-attachments";
import { WHOLESALE_ORDER_LIST_MAX_FILES } from "@/lib/wholesale-order-list-upload";

/** 管理弹窗只负责文件选择、提交及删除确认。列表和下载入口由父组件维护。 */
export function WholesaleOrderListAttachmentDialog({
  attachments,
  onDelete,
  onOpenChange,
  onUpload,
  open,
  orderId,
  orderNumber,
  pendingKey,
}: {
  attachments: WholesaleOrderListAttachment[];
  onDelete: (attachment: WholesaleOrderListAttachment) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: File[]) => Promise<boolean>;
  open: boolean;
  orderId: string;
  orderNumber: string;
  pendingKey: string | null;
}) {
  const confirm = useDashboardConfirm();
  const confirmT = useTranslations("DashboardFramework.confirm");
  const t = useTranslations("WholesaleBusiness.ordersUi.orderList");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadUnconfirmed, setUploadUnconfirmed] = useState(false);
  const uploadPending = pendingKey === `order-list:upload:${orderId}`;

  return (
    <DashboardDialog
      description={t("dialogDescription")}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setSelectedFiles([]);
          setUploadUnconfirmed(false);
        }
        onOpenChange(nextOpen);
      }}
      open={open}
      title={`${t("title")} · ${orderNumber}`}
    >
      <div className="space-y-5">
        <form
          className="rounded-record-card border border-dashed border-border-subtle bg-surface-inset p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (selectedFiles.length === 0) return;
            setUploadUnconfirmed(false);
            void onUpload(selectedFiles).then((succeeded) => {
              if (!succeeded) {
                // 在表单内保留当前文件与核对指引，方便重试时沿用原选择。
                setUploadUnconfirmed(true);
                return;
              }
              setSelectedFiles([]);
              onOpenChange(false);
            });
          }}
        >
          <p className="block text-sm font-semibold text-content-muted">{t("choose")}</p>
          <div className="mt-3">
            <DashboardFilePicker
              accept=".csv,.xls,.xlsx"
              files={selectedFiles}
              multiple
              onFiles={setSelectedFiles}
            />
          </div>
          <p className="mt-3 text-xs leading-5 text-content-muted">
            {t("help", { count: WHOLESALE_ORDER_LIST_MAX_FILES })}
          </p>
          {selectedFiles.length > 0 ? (
            <p className="mt-2 break-words text-xs text-primary">
              {t("selected", { count: selectedFiles.length })}
            </p>
          ) : null}
          {uploadUnconfirmed && !uploadPending ? (
            <p className="mt-2 break-words text-sm text-content-muted" role="status">
              {t("uploadUnconfirmed")}
            </p>
          ) : null}
          <div className="mt-4 flex justify-end">
            <Button
              variant="primary"
              size="default"
              disabled={uploadPending || selectedFiles.length === 0}
              type="submit"
            >
              {uploadPending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              {t("upload")}
            </Button>
          </div>
        </form>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-content-muted">{t("uploaded")}</h3>
          {attachments.length === 0 ? (
            <div className="rounded-control-default bg-surface-inset px-4 py-3 text-sm text-content-muted">
              {t("noneUploaded")}
            </div>
          ) : (
            attachments.map((attachment) => {
              const deletePending = pendingKey === `order-list:delete:${attachment.id}`;

              return (
                <div
                  className="flex min-w-0 flex-col gap-3 rounded-control-default border border-border-subtle bg-surface-interactive p-3 sm:flex-row sm:items-center sm:justify-between"
                  data-attachment-name={attachment.original_name}
                  key={attachment.id}
                >
                  <div className="flex min-w-0 items-start gap-2">
                    <FileSpreadsheet className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-content-muted [overflow-wrap:anywhere]">
                        {attachment.original_name}
                      </p>
                      <p className="mt-1 text-xs text-content-muted">
                        {formatFileSize(attachment.file_size_bytes)}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="default"
                    className="self-end sm:self-auto"
                    disabled={deletePending}
                    onClick={async () => {
                      if (
                        !(await confirm({
                          description: t("confirmDelete", {
                            name: attachment.original_name,
                          }),
                          title: confirmT("title"),
                          tone: "danger",
                        }))
                      )
                        return;
                      await onDelete(attachment);
                    }}
                    type="button"
                    variant="danger"
                  >
                    {deletePending ? (
                      <LoaderCircle className="size-4 animate-spin" />
                    ) : (
                      <Trash2 className="size-4" />
                    )}
                    {t("delete")}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </DashboardDialog>
  );
}

function formatFileSize(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(value / 1024, 0.1).toFixed(1)} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}
