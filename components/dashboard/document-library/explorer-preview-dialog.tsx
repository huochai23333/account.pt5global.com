"use client";

import { useState, type SyntheticEvent } from "react";
import { useTranslations } from "next-intl";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import type { DocumentFile } from "@/lib/document-library/model";

/** 直接使用受保护的预览地址，保留服务器的内容类型和预览安全策略。 */
export function ExplorerPreviewDialog({
  file,
  close,
}: {
  file: DocumentFile;
  close: () => void;
}) {
  const t = useTranslations("Documents");
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);

  function finish(event: SyntheticEvent<HTMLIFrameElement>) {
    const frame = event.currentTarget.contentDocument;
    // 错误接口正文也是一次 iframe 加载。只有已解码的图片或原生 PDF 可以显示。
    const image =
      frame?.contentType.startsWith("image/") &&
      (frame.querySelector("img")?.naturalWidth ?? 0) > 0;
    // Chrome 可把原生 PDF 查看器放在浏览器自己的文档里，页面无法读取该文档的 DOM。
    const pdf =
      file.mime_type === "application/pdf" &&
      (!frame ||
        frame.contentType === "application/pdf" ||
        Boolean(frame.querySelector('embed[type="application/pdf"]')));
    setState(image || pdf ? "ready" : "failed");
  }

  return (
    <DashboardDialog
      open
      title={t("preview")}
      onOpenChange={(open) => {
        if (!open) close();
      }}
      actions={
        <Button variant="outline" onClick={close}>
          {t("cancel")}
        </Button>
      }
    >
      {state === "loading" && <p role="status">{t("loading")}</p>}
      {state === "failed" ? (
        <div className="space-y-3" role="alert">
          <p className="text-status-danger">{t("previewFailed")}</p>
          <Button
            variant="outline"
            onClick={() => {
              setState("loading");
              setAttempt((value) => value + 1);
            }}
          >
            {t("previewRetry")}
          </Button>
        </div>
      ) : (
        <iframe
          key={attempt}
          title={file.name}
          src={`/api/document-library/files/${file.id}/content?preview=1`}
          aria-hidden={state === "loading"}
          // 原生 PDF 在初始化时读取框的尺寸，加载中也预留最终高度。
          className={`h-[65vh] w-full rounded-lg border ${state === "loading" ? "opacity-0" : ""}`}
          onLoad={finish}
          onError={() => setState("failed")}
        />
      )}
    </DashboardDialog>
  );
}
