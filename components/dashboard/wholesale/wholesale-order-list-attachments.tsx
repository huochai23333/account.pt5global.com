"use client";

import { Download, LoaderCircle, Upload } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { getBrowserSupabaseClient } from "@/lib/supabase";
import {
  createWholesaleOrderListDownloadUrl,
  type WholesaleOrderListAttachment,
} from "@/lib/wholesale-order-list-attachments";
import { WholesaleOrderListAttachmentDialog } from "./wholesale-order-list-attachment-dialog";

type WholesaleOrderListAttachmentsProps = {
  attachments: WholesaleOrderListAttachment[];
  canManage: boolean;
  compact?: boolean;
  onDelete: (attachment: WholesaleOrderListAttachment) => void | Promise<void>;
  onUpload: (files: File[]) => Promise<boolean>;
  orderId: string;
  orderNumber: string;
  pendingKey: string | null;
};

/**
 * 表格单元格和移动端详情共用同一份附件展示。
 * 客户只能触发下载；有管理权限的内部人员会额外看到上传和删除入口。
 */
export function WholesaleOrderListAttachments({
  attachments,
  canManage,
  compact = false,
  onDelete,
  onUpload,
  orderId,
  orderNumber,
  pendingKey,
}: WholesaleOrderListAttachmentsProps) {
  const t = useTranslations("WholesaleBusiness.ordersUi.orderList");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [downloadPendingId, setDownloadPendingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const downloadAttachment = async (attachment: WholesaleOrderListAttachment) => {
    const supabase = getBrowserSupabaseClient();

    if (!supabase) {
      setDownloadError(t("connectionFailed"));
      return;
    }

    setDownloadPendingId(attachment.id);
    setDownloadError(null);

    try {
      const signedUrl = await createWholesaleOrderListDownloadUrl(supabase, attachment);
      // Storage 签名地址与网页不在同一个来源，浏览器可能忽略跨来源链接的
      // download 属性并直接打开 CSV。先读取文件再生成本地对象地址，可以让
      // CSV、XLS 和 XLSX 都稳定地以原始文件名保存到用户设备。
      const response = await fetch(signedUrl);

      if (!response.ok) {
        throw new Error("Order List 附件暂时无法下载。");
      }

      const objectUrl = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.rel = "noopener";
      anchor.download = attachment.original_name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      // 等浏览器接管下载后再释放临时地址，避免在较慢设备上提前失效。
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      setDownloadError(t("downloadFailed"));
    } finally {
      setDownloadPendingId(null);
    }
  };

  return (
    <div className="min-w-0 space-y-2">
      {attachments.length > 0 ? (
        <div className={compact ? "max-h-24 space-y-2 overflow-y-auto pr-1" : "space-y-2"}>
          {attachments.map((attachment) => (
            <Button
              size="default"
              className="max-w-full justify-start"
              disabled={downloadPendingId === attachment.id}
              key={attachment.id}
              onClick={() => void downloadAttachment(attachment)}
              title={attachment.original_name}
              type="button"
              variant="outline"
              wrap
            >
              {downloadPendingId === attachment.id ? (
                <LoaderCircle className="size-3.5 shrink-0 animate-spin" />
              ) : (
                <Download className="size-3.5 shrink-0" />
              )}
              {/* 文件名可能有多行，靠左便于读出连续文字。 */}
              <span className="min-w-0 break-words text-left [overflow-wrap:anywhere]">
                {attachment.original_name}
              </span>
            </Button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-content-muted">{t("empty")}</p>
      )}

      {canManage ? (
        <Button size="compact" onClick={() => setDialogOpen(true)} type="button" variant="outline">
          <Upload className="size-3.5" />
          {t("manage")}
        </Button>
      ) : null}

      {downloadError ? (
        <p className="break-words text-xs leading-5 text-content-muted">{downloadError}</p>
      ) : null}

      {canManage ? (
        <WholesaleOrderListAttachmentDialog
          attachments={attachments}
          onDelete={onDelete}
          onOpenChange={setDialogOpen}
          onUpload={onUpload}
          open={dialogOpen}
          orderId={orderId}
          orderNumber={orderNumber}
          pendingKey={pendingKey}
        />
      ) : null}
    </div>
  );
}
