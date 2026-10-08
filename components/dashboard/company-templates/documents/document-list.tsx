"use client";
import Link from "next/link";
import {useTranslations,useLocale} from "next-intl";
import {Button} from "@/components/ui/button";
import {Field,Input} from "@/components/ui/form-controls";
import {Surface} from "@/components/ui/surface";
import type {TemplateDocumentSummary} from "@/lib/company-templates/documents/model";
import {useDocumentList} from "./use-document-list";
import {DocumentActions} from "./document-actions";
/** 列表只渲染摘要；搜索与管理请求分别放在同层模块。 */
export function DocumentList({initial,workspace}:{initial:TemplateDocumentSummary[];workspace:string}){
  const t=useTranslations("CompanyTemplates.documents");const locale=useLocale();const list=useDocumentList(initial);
  return <section className="mx-auto grid w-full max-w-[1600px] gap-4">
    <div><h2 className="text-xl font-bold">{t("title")}</h2><p className="text-sm text-content-muted">{t("privateNotice")}</p></div>
    <Field label={t("search")}><Input value={list.search} onChange={event=>list.setSearch(event.target.value)} maxLength={120}/></Field>
    {list.error?<p role="alert">{t("errors.document_failed")} <Button onClick={list.reload}>{t("retry")}</Button></p>:null}
    {list.busy?<p role="status">{t("loading")}</p>:null}
    {!list.busy&&!list.documents.length?<Surface padding="compact"><p>{t("empty")}</p></Surface>:null}
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-2">{list.documents.map(document=><Surface as="article" key={document.id} padding="compact" className="grid min-w-0 gap-3">
      <h3 className="break-words text-lg font-semibold">{document.name}</h3><p className="break-words text-sm text-content-muted">{document.template_name} · {new Date(document.updated_at).toLocaleString(locale)}</p>
      <Link className="inline-flex min-h-10 items-center font-semibold text-primary" href={`/${workspace}/company-templates/documents/${document.id}`}>{t("edit")}</Link>
      <DocumentActions document={document} workspace={workspace} getRevision={()=>document.revision} disabled={list.busy}/>
    </Surface>)}</div>
    {list.more?<Button disabled={list.busy} onClick={list.loadMore}>{t("more")}</Button>:null}
  </section>;
}
