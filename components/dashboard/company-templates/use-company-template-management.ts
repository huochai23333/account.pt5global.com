"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DashboardActionFeedback } from "@/components/dashboard/dashboard-page-shell";
import { getCompanyTemplateDisplayError } from "@/lib/company-templates/display-error";
import type { CompanyTemplateStateReceipt, CompanyTemplateSummary } from "@/lib/company-templates/model";

type ManagementRequest = { templateId: string; expectedRevision: number } & (
  | { action: "activate"; versionId: string }
  | { action: "status"; active: boolean }
);

/** 管理状态与写入离开列表组装组件，避免新文档功能继续堆入核心文件。 */
export function useCompanyTemplateManagement() {
  const t = useTranslations("CompanyTemplates");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inFlight = useRef(false);
  const [managingKey, setManagingKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<DashboardActionFeedback>(null);
  const [publishTarget, setPublishTarget] = useState<CompanyTemplateSummary | null | undefined>();
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    // 手机不提供模板编辑入口；从宽屏切到窄屏时也关闭已经打开的上传窗口。
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => { setDesktop(media.matches); if (!media.matches) setPublishTarget(undefined); };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  function refresh(message: string) {
    setFeedback({ message, tone: "success" });
    startTransition(() => router.refresh());
  }

  async function manage(body: ManagementRequest, currentVersionId: string, successMessage: string, actionKey: string) {
    if (inFlight.current || pending) return;
    inFlight.current = true;
    // 请求开始时就记录当前操作；页面刷新只覆盖请求完成后的等待阶段。
    setManagingKey(actionKey);
    setFeedback(null);
    try {
      const response = await fetch("/api/company-templates/manage", {
        body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, method: "POST",
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json() as { error?: string; ok?: boolean; receipt?: CompanyTemplateStateReceipt } | null;
      const receipt = result?.receipt;
      const versionId = body.action === "activate" ? body.versionId : currentVersionId;
      const status = body.action === "activate" || body.active ? "active" : "inactive";
      // 核对回执确实属于页面发出的操作。断线后保留卡片原修订号，重复操作可取回相同结果。
      if (!response.ok || result?.ok !== true || !receipt || receipt.template_id !== body.templateId
        || receipt.version_id !== versionId || receipt.status !== status || receipt.revision !== body.expectedRevision + 1) {
        throw new Error(result?.error ?? "company_template_manage_failed");
      }
      refresh(successMessage);
    } catch (cause) {
      const code = getCompanyTemplateDisplayError(cause, "company_template_manage_failed");
      setFeedback({ message: t(`errors.${code}`), tone: "error" });
    } finally {
      inFlight.current = false;
      setManagingKey(null);
    }
  }

  return { t, pending, managingKey, feedback, publishTarget, setPublishTarget, desktop, refresh, manage };
}
