"use client";

import { useEffect, useState, useTransition } from "react";
import { FileCode2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { DashboardPageShell, type DashboardActionFeedback } from "@/components/dashboard/dashboard-page-shell";
import { EmptyState } from "@/components/dashboard/dashboard-shared-ui";
import { DashboardListHeader, DashboardSectionPanel } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import { getCompanyTemplateDisplayError } from "@/lib/company-templates/display-error";
import type { CompanyTemplateSummary } from "@/lib/company-templates/model";

import { CompanyTemplateCard } from "./company-template-card";
import { CompanyTemplatePublishDialog } from "./company-template-publish-dialog";

/** 列表客户端统一管理弹窗、页面反馈和刷新；初始模板数据仍由服务端页面在权限校验后读取。 */
export function CompanyTemplatesClient({ initialTemplates, isAdmin, workspace }: {
  initialTemplates: CompanyTemplateSummary[];
  isAdmin: boolean;
  workspace: string;
}) {
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

  return (
    <DashboardPageShell
      feedback={feedback}
      header={<DashboardListHeader actions={isAdmin && desktop ? <Button onClick={() => setPublishTarget(null)}><Plus className="size-4" />{t("actions.create")}</Button> : null} description={t("description")} title={t("title")} />}
    >
      {!desktop ? <p className="rounded-xl bg-surface-inset p-5 text-sm text-content-muted">{t("viewer.desktopOnly")}</p> : initialTemplates.length ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-2">
          {initialTemplates.map((template) => <CompanyTemplateCard
            busy={pending || managingKey !== null}
            managingKey={managingKey}
            isAdmin={isAdmin}
            key={template.id}
            onActivate={(item, versionId) => manage({ action: "activate", expectedRevision: item.revision, templateId: item.id, versionId }, t("feedback.restored"), `${item.id}:activate:${versionId}`)}
            onPublish={(item) => setPublishTarget(item)}
            onToggleStatus={(item) => manage({ action: "status", active: item.status !== "active", expectedRevision: item.revision, templateId: item.id }, t(item.status === "active" ? "feedback.disabled" : "feedback.enabled"), `${item.id}:status`)}
            template={template}
            text={(key, values) => t(key, values)}
            workspace={workspace}
          />)}
        </div>
      ) : (
        <DashboardSectionPanel><EmptyState description={t("empty.description")} icon={<FileCode2 className="size-6" />} title={t("empty.title")} /></DashboardSectionPanel>
      )}
      <CompanyTemplatePublishDialog
        onClose={() => setPublishTarget(undefined)}
        onPublished={refresh}
        open={publishTarget !== undefined}
        template={publishTarget ?? null}
        text={(key) => t(key)}
      />
    </DashboardPageShell>
  );
}
