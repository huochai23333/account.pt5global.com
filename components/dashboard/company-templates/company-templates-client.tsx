"use client";

import { useState, useTransition } from "react";
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
  const [feedback, setFeedback] = useState<DashboardActionFeedback>(null);
  const [publishTarget, setPublishTarget] = useState<CompanyTemplateSummary | null | undefined>();

  function refresh(message: string) {
    setFeedback({ message, tone: "success" });
    startTransition(() => router.refresh());
  }

  async function manage(body: Record<string, unknown>, successMessage: string) {
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
    }
  }

  return (
    <DashboardPageShell
      feedback={feedback}
      header={<DashboardListHeader actions={isAdmin ? <Button onClick={() => setPublishTarget(null)}><Plus className="size-4" />{t("actions.create")}</Button> : null} description={t("description")} title={t("title")} />}
    >
      {initialTemplates.length ? (
        <div className="grid min-w-0 gap-5 xl:grid-cols-2">
          {initialTemplates.map((template) => <CompanyTemplateCard
            busy={pending}
            isAdmin={isAdmin}
            key={template.id}
            onActivate={(item, versionId) => manage({ action: "activate", expectedRevision: item.revision, templateId: item.id, versionId }, t("feedback.restored"))}
            onPublish={(item) => setPublishTarget(item)}
            onToggleStatus={(item) => manage({ action: "status", active: item.status !== "active", expectedRevision: item.revision, templateId: item.id }, t(item.status === "active" ? "feedback.disabled" : "feedback.enabled"))}
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
