"use client";

import { useEffect, useId, useState } from "react";

import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { DashboardFilePicker } from "@/components/dashboard/dashboard-framework-primitives";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { getCompanyTemplateDisplayError } from "@/lib/company-templates/display-error";
import type { CompanyTemplateSummary } from "@/lib/company-templates/model";

type PublishDialogProps = {
  onClose: () => void;
  onPublished: (message: string) => void;
  open: boolean;
  template: CompanyTemplateSummary | null;
  text: (key: string) => string;
};

/** 上传弹窗只收集文件和模板资料，文件校验、权限与数据库确认都由服务端完成。 */
export function CompanyTemplatePublishDialog({ onClose, onPublished, open, template, text }: PublishDialogProps) {
  const formId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [htmlFiles, setHtmlFiles] = useState<File[]>([]);
  const [guideFiles, setGuideFiles] = useState<File[]>([]);
  useEffect(() => {
    if (!open) return;
    setError(null);
    setHtmlFiles([]);
    setGuideFiles([]);
  }, [open, template]);
  if (!open) return null;

  async function submit(formData: FormData) {
    setBusy(true);
    setError(null);
    const templateId = template?.id ?? crypto.randomUUID();
    formData.set("templateId", templateId);
    formData.set("versionId", crypto.randomUUID());
    formData.set("expectedRevision", template ? String(template.revision) : "");
    if (htmlFiles[0]) formData.set("htmlFile", htmlFiles[0]);
    if (guideFiles[0]) formData.set("guideFile", guideFiles[0]);
    try {
      const response = await fetch("/api/company-templates/publish", { method: "POST", body: formData });
      const result = await response.json() as { error?: string; ok?: boolean; receipt?: { version_number?: number } };
      if (!response.ok || result.ok !== true || !result.receipt?.version_number) {
        throw new Error(result.error ?? "company_template_publish_failed");
      }
      onPublished(text(template ? "feedback.updated" : "feedback.created"));
      onClose();
    } catch (cause) {
      setError(text(`errors.${getCompanyTemplateDisplayError(cause, "company_template_publish_failed")}`));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DashboardDialog
      actions={<>
        <Button disabled={busy} onClick={onClose} type="button" variant="outline">{text("actions.cancel")}</Button>
        <Button disabled={busy || htmlFiles.length === 0} form={formId} type="submit">{text(busy ? "actions.publishing" : "actions.publish")}</Button>
      </>}
      description={text("publish.description")}
      onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onClose(); }}
      open={open}
      title={text(template ? "publish.updateTitle" : "publish.createTitle")}
    >
        <form action={submit} className="grid gap-5" id={formId}>
          <Field label={text("fields.name")} required>
            <Input defaultValue={template?.name ?? ""} maxLength={120} name="name" required />
          </Field>
          <Field label={text("fields.slug")} required>
            <Input defaultValue={template?.slug ?? ""} maxLength={80} name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
          </Field>
          <Field label={text("fields.description")}>
            <Textarea className="min-h-24" defaultValue={template?.description ?? ""} maxLength={500} name="description" />
          </Field>
          <div className="grid gap-2">
            <DashboardFilePicker
              accept=".html,.htm,text/html"
              disabled={busy}
              files={htmlFiles}
              label={text("fields.htmlFile")}
              onFiles={(files) => setHtmlFiles(files.slice(0, 1))}
            />
            <p className="text-xs leading-5 text-content-muted">{text("fields.htmlHint")}</p>
          </div>
          <div className="grid gap-2">
            <DashboardFilePicker
              accept=".html,.htm,text/html"
              disabled={busy}
              files={guideFiles}
              label={text("fields.guideFile")}
              onFiles={(files) => setGuideFiles(files.slice(0, 1))}
            />
            <p className="text-xs leading-5 text-content-muted">{text(template ? "fields.guideKeepHint" : "fields.guideHint")}</p>
          </div>
          {error ? <p className="rounded-xl bg-status-danger-soft px-4 py-3 text-sm text-status-danger" role="alert">{error}</p> : null}
        </form>
    </DashboardDialog>
  );
}
