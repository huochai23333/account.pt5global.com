"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { DashboardActionFeedback } from "@/components/dashboard/dashboard-page-shell";
import { getCompanyTemplateDisplayError } from "@/lib/company-templates/display-error";
import type { CompanyTemplateSummary } from "@/lib/company-templates/model";
/** 管理状态与写入离开列表组装组件，避免新文档功能继续堆入核心文件。 */
export function useCompanyTemplateManagement() {
  const t = useTranslations("CompanyTemplates");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
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

  async function manage(body: Record<string, unknown>, successMessage: string, actionKey: string) {
    if (managingKey || pending) return;
    // 请求开始时就记录当前操作；页面刷新只覆盖请求完成后的等待阶段。
    setManagingKey(actionKey);
    setFeedback(null);
    try {
      const response = await fetch("/api/company-templates/manage", {
        body: JSON.stringify(body), headers: { "Content-Type": "application/json" }, method: "POST",
      });
      const result = await response.json() as { error?: string; ok?: boolean; receipt?: unknown };
      // HTTP 成功不代表业务成功；只有 ok=true 且带最终回执时才刷新页面并显示成功。
      if (!response.ok || result.ok !== true || !result.receipt) throw new Error(result.error ?? "company_template_manage_failed");
      refresh(successMessage);
    } catch (cause) {
      const code = getCompanyTemplateDisplayError(cause, "company_template_manage_failed");
      setFeedback({ message: t(`errors.${code}`), tone: "error" });
    } finally {
      setManagingKey(null);
    }
  }

  return { t, pending, managingKey, feedback, publishTarget, setPublishTarget, desktop, refresh, manage };
}
