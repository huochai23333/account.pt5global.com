"use client";

import { useId, useState } from "react";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { DashboardFilePicker } from "@/components/dashboard/dashboard-framework-primitives";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import type { CompanyTemplateSummary } from "@/lib/company-templates/model";
import { useCompanyTemplatePublication } from "./use-company-template-publication";

type PublishDialogProps = {
  onClose: () => void;
  onPublished: (message: string) => void;
  template: CompanyTemplateSummary | null;
  text: (key: string) => string;
};

/** 弹窗负责收集模板资料，发布 Hook 保存可重试的提交，服务端确认权限和数据库终态。 */
export function CompanyTemplatePublishDialog({ onClose, onPublished, template, text }: PublishDialogProps) {
  const formId = useId();
  const [htmlFiles, setHtmlFiles] = useState<File[]>([]);
  const [guideFiles, setGuideFiles] = useState<File[]>([]);
  const { busy, error, recovering, submit } = useCompanyTemplatePublication({
    template,
    htmlFile: htmlFiles[0],
    guideFile: guideFiles[0],
    onPublished: () => {
      onPublished(text(template ? "feedback.updated" : "feedback.created"));
      onClose();
    },
  });
  const fieldsLocked = busy || recovering;

  return (
    <DashboardDialog
      actions={<>
        <Button disabled={busy} onClick={onClose} type="button" variant="outline">{text("actions.cancel")}</Button>
        <Button disabled={busy || htmlFiles.length === 0} loading={busy} form={formId} type="submit">{text(busy ? "actions.publishing" : "actions.publish")}</Button>
      </>}
      description={text("publish.description")}
      onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onClose(); }}
      open
      title={text(template ? "publish.updateTitle" : "publish.createTitle")}
    >
        <form onSubmit={submit} className="grid gap-5" id={formId}>
          <Field label={text("fields.name")} required>
            <Input defaultValue={template?.name ?? ""} disabled={fieldsLocked} maxLength={120} name="name" required />
          </Field>
          <Field label={text("fields.slug")} required>
            <Input defaultValue={template?.slug ?? ""} disabled={fieldsLocked} maxLength={80} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
          </Field>
          <Field label={text("fields.description")}>
            <Textarea className="min-h-24" defaultValue={template?.description ?? ""} disabled={fieldsLocked} maxLength={500} name="description" />
          </Field>
          <div className="grid gap-2">
            <DashboardFilePicker
              accept=".html,.htm,text/html"
              disabled={fieldsLocked}
              files={htmlFiles}
              label={text("fields.htmlFile")}
              onFiles={(files) => setHtmlFiles(files.slice(0, 1))}
            />
            <p className="text-xs leading-5 text-content-muted">{text("fields.htmlHint")}</p>
          </div>
          <div className="grid gap-2">
            <DashboardFilePicker
              accept=".html,.htm,text/html"
              disabled={fieldsLocked}
              files={guideFiles}
              label={text("fields.guideFile")}
              onFiles={(files) => setGuideFiles(files.slice(0, 1))}
            />
            <p className="text-xs leading-5 text-content-muted">{text(template ? "fields.guideKeepHint" : "fields.guideHint")}</p>
          </div>
          {error ? (
            <p className="rounded-xl bg-status-danger-soft px-4 py-3 text-sm text-status-danger" role="alert">
              {text(recovering && error !== "company_template_revision_conflict" && error !== "company_template_forbidden"
                ? "publish.recoveryNotice"
                : `errors.${error}`)}
            </p>
          ) : null}
        </form>
    </DashboardDialog>
  );
}
