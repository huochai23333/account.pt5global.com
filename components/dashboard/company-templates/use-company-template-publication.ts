"use client";

import { useRef, useState, type FormEvent } from "react";

import { getCompanyTemplateDisplayError } from "@/lib/company-templates/display-error";
import { verifyTemplateUsability } from "@/lib/company-templates/documents/publish-preflight";
import type { CompanyTemplatePublishReceipt, CompanyTemplateSummary } from "@/lib/company-templates/model";

type Publication = {
  body: FormData;
  revision: number;
  templateId: string;
  versionId: string;
};

const editableErrors = new Set([
  "company_template_forbidden",
  "company_template_revision_conflict",
  "company_template_file_required",
  "company_template_file_type",
  "company_template_file_too_large",
  "company_template_file_encoding",
  "company_template_file_document",
  "company_template_file_unsafe",
  "company_template_slug_invalid",
  "company_template_details_invalid",
  "company_template_save_protocol_invalid",
  "company_template_open_check_failed",
]);

export function useCompanyTemplatePublication({
  template,
  htmlFile,
  guideFile,
  onPublished,
}: {
  template: CompanyTemplateSummary | null;
  htmlFile?: File;
  guideFile?: File;
  onPublished: () => void;
}) {
  const inFlight = useRef(false);
  const submitted = useRef<Publication | null>(null);
  const [busy, setBusy] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    // 自己处理提交，响应失败时保留表单。同步锁拦住 React 尚未刷新按钮时的第二次提交。
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      let publication = submitted.current;
      if (!publication) {
        const body = new FormData(event.currentTarget);
        if (!htmlFile) throw new Error("company_template_file_required");
        await verifyTemplateUsability(htmlFile);
        const templateId = template?.id ?? crypto.randomUUID();
        const versionId = crypto.randomUUID();
        body.set("templateId", templateId);
        body.set("versionId", versionId);
        body.set("expectedRevision", template ? String(template.revision) : "");
        body.set("htmlFile", htmlFile);
        if (guideFile) body.set("guideFile", guideFile);
        publication = { body, revision: (template?.revision ?? 0) + 1, templateId, versionId };
        // 请求发出后数据库可能已提交。重试必须沿用完全相同的编号、文件和预期修订号。
        submitted.current = publication;
      }
      const response = await fetch("/api/company-templates/publish", {
        method: "POST",
        body: publication.body,
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json() as {
        error?: string;
        ok?: boolean;
        receipt?: CompanyTemplatePublishReceipt;
      } | null;
      if (!response.ok || result?.ok !== true) {
        // 校验失败或版本冲突时允许重新编辑。写后核对失败或未知响应仍保留提交快照。
        if (result?.error && editableErrors.has(result.error) && !recovering) submitted.current = null;
        throw new Error(result?.error ?? "company_template_publish_failed");
      }
      const receipt = result.receipt;
      if (!receipt || receipt.template_id !== publication.templateId || receipt.version_id !== publication.versionId
        || receipt.revision !== publication.revision || receipt.status !== "active"
        || !Number.isInteger(receipt.version_number) || receipt.version_number < 1
        || !/^[a-f0-9]{64}$/.test(receipt.html_sha256)) {
        throw new Error("company_template_publish_receipt_invalid");
      }
      onPublished();
    } catch (cause) {
      setRecovering(submitted.current !== null);
      setError(getCompanyTemplateDisplayError(cause, "company_template_publish_failed"));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return { busy, error, recovering, submit };
}
