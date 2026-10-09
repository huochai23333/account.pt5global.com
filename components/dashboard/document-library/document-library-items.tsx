"use client";
import Link from "next/link";
import {useParams} from "next/navigation";
import {useTranslations} from "next-intl";
import type {ComponentProps} from "react";
import type {DocumentLibraryItem} from "@/lib/document-library/model";
import {templateDocumentHref} from "@/lib/company-templates/documents/navigation";
import {DocumentActions} from "@/components/dashboard/company-templates/documents/document-actions";
import {DocumentFiles} from "./document-files";
/** 服务端已经统一分页；这里只按种类展示，不再重新排序或拼接分页结果。 */
export function DocumentLibraryItems({items, canManage, busy, onFileAction, reload}: {
  items: DocumentLibraryItem[]; canManage: boolean; busy: boolean;
  onFileAction: ComponentProps<typeof DocumentFiles>["onAction"]; reload: () => void;
}) {
  const t=useTranslations("CompanyTemplates.documents"); const {workspace}=useParams<{workspace:string}>();
  if (!items.length) return <DocumentFiles files={[]} canManage={canManage} busy={busy} onAction={onFileAction}/>;
  return <div className="grid min-w-0 gap-3">{items.map(item => item.kind==="file"
    ? <DocumentFiles key={item.file.id} files={[item.file]} canManage={canManage} busy={busy} onAction={onFileAction}/>
    : <article key={item.document.id} data-template-document={item.document.id} className="grid min-w-0 gap-3 rounded-record-card border border-border-subtle bg-surface-interactive p-4">
      <h3 className="break-words font-semibold [overflow-wrap:anywhere]">{item.document.name}</h3>
      <p className="break-words text-sm text-content-muted">{t("type")} · {item.document.template_name}</p>
      <div className="flex flex-wrap items-center gap-2">
        <Link className="inline-flex min-h-11 items-center rounded-lg border border-border-subtle px-3 text-sm font-semibold text-primary" href={templateDocumentHref(workspace,item.document.id)}>{t(canManage?"edit":"viewDocument")}</Link>
        {canManage?<DocumentActions document={item.document} workspace={workspace} getRevision={()=>item.document.revision} disabled={busy} onChanged={reload} onDeleted={reload}/>:null}
      </div>
    </article>)}</div>;
}
