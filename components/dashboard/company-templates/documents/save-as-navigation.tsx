"use client";
import {useTranslations} from "next-intl";
import {ArrowLeft,ArrowRight,ArrowUp} from "lucide-react";
import {Button} from "@/components/ui/button";
import {Field,Input} from "@/components/ui/form-controls";
import {folderLabel} from "@/components/dashboard/document-library/folder-label";
import type {SaveAsBrowser} from "./use-save-as-browser";
/** 路径由授权目录逐级计算，并用访问集合阻止异常目录循环；路径按钮和历史共用导航状态。 */
export function useSaveAsPath(browser:SaveAsBrowser){
 const library=useTranslations("Documents");const parents=[];const visited=new Set<string>();let parent=browser.folder;
 while(parent&&!visited.has(parent.id)){visited.add(parent.id);parents.unshift(parent);parent=browser.data.folders.find(f=>f.id===parent?.parent_id);}
 const archive=browser.data.archives.find(a=>a.id===browser.folder?.archive_id);return{parents,archive,path:[archive?.name,...parents.map(f=>folderLabel(f,library))].filter(Boolean).join(" / ")};
}
export function SaveAsNavigation({browser,busy,onNewFolder}:{browser:SaveAsBrowser;busy:boolean;onNewFolder:()=>void}){
 const t=useTranslations("CompanyTemplates.documents");const library=useTranslations("Documents");const {parents,archive}=useSaveAsPath(browser);
 return <><div className="flex min-w-0 flex-wrap items-center gap-2"><Button size="icon" variant="outline" aria-label={library("explorer.back")} disabled={busy||!browser.canBack} onClick={browser.back}><ArrowLeft aria-hidden className="size-4"/></Button><Button size="icon" variant="outline" aria-label={library("explorer.forward")} disabled={busy||!browser.canForward} onClick={browser.forward}><ArrowRight aria-hidden className="size-4"/></Button><Button size="icon" variant="outline" aria-label={t("folderUp")} disabled={busy||!browser.folder?.parent_id} onClick={browser.up}><ArrowUp aria-hidden className="size-4"/></Button><nav aria-label={t("folderPath")} className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">{archive&&<span className="shrink-0">{archive.name}</span>}{parents.map(f=><Button key={f.id} size="compact" variant="ghost" title={folderLabel(f,library)} disabled={busy} className="max-w-44 shrink-0 truncate" onClick={()=>browser.navigate(f.id)}>{folderLabel(f,library)}</Button>)}</nav></div>
 <div className="flex min-w-0 flex-wrap items-end gap-2"><Field className="min-w-0 flex-1" label={t("saveAsSearch")}><Input disabled={busy} maxLength={120} value={browser.query} onChange={event=>browser.setQuery(event.target.value)}/></Field><Button variant="outline" disabled={busy||!browser.folder||browser.loading} onClick={onNewFolder}>{library("explorer.create")}</Button></div></>;
}
