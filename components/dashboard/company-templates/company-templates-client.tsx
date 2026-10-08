"use client";

import { FileCode2, Plus } from "lucide-react";

import { DashboardPageShell } from "@/components/dashboard/dashboard-page-shell";
import { EmptyState } from "@/components/dashboard/dashboard-shared-ui";
import { DashboardListHeader, DashboardSectionPanel } from "@/components/dashboard/dashboard-section-panel";
import { Button } from "@/components/ui/button";
import type { CompanyTemplateSummary } from "@/lib/company-templates/model";

import { useCompanyTemplateManagement } from "./use-company-template-management";
import { CompanyTemplateCard } from "./company-template-card";
import { CompanyTemplatePublishDialog } from "./company-template-publish-dialog";

/** 列表客户端统一管理弹窗、页面反馈和刷新；初始模板数据仍由服务端页面在权限校验后读取。 */
export function CompanyTemplatesClient({ initialTemplates, isAdmin, workspace }: {
  initialTemplates: CompanyTemplateSummary[];
  isAdmin: boolean;
  workspace: string;
}) {
  const { t, pending, managingKey, feedback, publishTarget, setPublishTarget, desktop, refresh, manage } = useCompanyTemplateManagement();

  return (
    <DashboardPageShell
      feedback={feedback}
      header={<DashboardListHeader actions={isAdmin && desktop ? <Button onClick={() => setPublishTarget(null)}><Plus className="size-4" />{t("actions.create")}</Button> : null} description={t("description")} title={t("title")} />}
    >
      {!desktop ? <p className="rounded-xl bg-surface-inset p-5 text-sm text-content-muted">{t("viewer.desktopOnly")}</p> : initialTemplates.length ? (
        // 每张卡片按自己的内容高度排列；展开一侧的版本记录时，另一侧不应跟着变长。
        <div className="grid min-w-0 items-start gap-5 xl:grid-cols-2">
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
