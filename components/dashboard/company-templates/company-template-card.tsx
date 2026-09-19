"use client";

import Link from "next/link";
import { BookOpen, FileCode2, History, Power, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { RecordCard } from "@/components/ui/data-display";
import { StatusBadge } from "@/components/ui/status-badge";
import type { CompanyTemplateSummary } from "@/lib/company-templates/model";

/** 模板卡片只负责展示和发出管理意图，真正的权限、写入和回执核对都留在服务端。 */
export function CompanyTemplateCard({
  busy,
  isAdmin,
  onActivate,
  onPublish,
  onToggleStatus,
  template,
  text,
  workspace,
}: {
  busy: boolean;
  isAdmin: boolean;
  onActivate: (template: CompanyTemplateSummary, versionId: string) => void;
  onPublish: (template: CompanyTemplateSummary) => void;
  onToggleStatus: (template: CompanyTemplateSummary) => void;
  template: CompanyTemplateSummary;
  text: (key: string, values?: Record<string, string | number>) => string;
  workspace: string;
}) {
  const usable = template.status === "active";
  return (
    <RecordCard className="flex min-w-0 flex-col" surface="inset">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="rounded-2xl bg-status-info-soft p-3 text-primary"><FileCode2 className="size-6" /></span>
          <div className="min-w-0">
            <h2 className="break-words text-lg font-bold text-content-strong">{template.name}</h2>
            <p className="mt-1 break-words text-sm leading-6 text-content-muted">{template.description}</p>
          </div>
        </div>
        <StatusBadge tone={usable ? "success" : "neutral"}>{text(usable ? "status.active" : "status.inactive")}</StatusBadge>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 rounded-2xl bg-surface-inset p-4 text-sm">
        <div><dt className="text-content-muted">{text("labels.version")}</dt><dd className="mt-1 font-semibold">{text("labels.versionValue", { version: template.currentVersion.version_number })}</dd></div>
        <div><dt className="text-content-muted">{text("labels.file")}</dt><dd className="mt-1 truncate font-semibold" title={template.currentVersion.source_filename}>{template.currentVersion.source_filename}</dd></div>
      </dl>
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {usable ? <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white" href={`/${workspace}/company-templates/${template.id}`}><FileCode2 className="size-4" />{text("actions.open")}</Link> : null}
        {usable && template.currentVersion.guide_sha256 ? <Link className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-input bg-background px-4 text-sm font-semibold text-content-strong" href={`/${workspace}/company-templates/${template.id}/guide`}><BookOpen className="size-4" />{text("actions.guide")}</Link> : null}
        {isAdmin ? <Button disabled={busy} onClick={() => onPublish(template)} size="compact" type="button" variant="outline"><Upload className="size-4" />{text("actions.newVersion")}</Button> : null}
        {isAdmin ? <Button disabled={busy} onClick={() => onToggleStatus(template)} size="compact" type="button" variant="ghost"><Power className="size-4" />{text(usable ? "actions.disable" : "actions.enable")}</Button> : null}
      </div>
      {isAdmin && template.versions.length > 1 ? (
        <details className="mt-5 border-t border-border-subtle pt-4">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-content-strong"><History className="size-4" />{text("actions.history")}</summary>
          <div className="mt-3 grid gap-2">
            {template.versions.map((version) => {
              const current = version.id === template.currentVersion.id;
              return <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-surface-inset px-3 py-2" key={version.id}>
                <span className="min-w-0 truncate text-sm">{text("labels.historyVersion", { file: version.source_filename, version: version.version_number })}</span>
                {current ? <span className="shrink-0 text-xs font-semibold text-status-success">{text("status.current")}</span>
                  : <Button disabled={busy} onClick={() => onActivate(template, version.id)} size="compact" type="button" variant="ghost">{text("actions.restore")}</Button>}
              </div>;
            })}
          </div>
        </details>
      ) : null}
    </RecordCard>
  );
}
