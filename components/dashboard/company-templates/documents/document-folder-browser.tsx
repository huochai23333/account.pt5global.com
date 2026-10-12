"use client";
import {useTranslations} from "next-intl";
import {ArrowUp,Folder} from "lucide-react";
import {Button,InteractiveButton} from "@/components/ui/button";
import {folderPath} from "@/components/dashboard/document-library/explorer-helpers";
import {folderLabel} from "@/components/dashboard/document-library/folder-label";
import type {DestinationController} from "./use-document-destinations";
/** 只浏览服务端返回的目录；搜索跨档案匹配完整路径，选择时不改变保存权限。 */
export function DocumentFolderBrowser({selection,busy}:{selection:DestinationController;busy:boolean}){
 const t=useTranslations("CompanyTemplates.documents");const library=useTranslations("Documents");const {data,archiveId,folderId,query}=selection;
 const current=data.folders.find(folder=>folder.id===folderId);const archive=data.archives.find(item=>item.id===archiveId);const parents=[];const visited=new Set<string>();let parent=current;
 while(parent&&!visited.has(parent.id)){visited.add(parent.id);parents.unshift(parent);parent=data.folders.find(item=>item.id===parent?.parent_id);}
 const path=(id:string)=>folderPath(id,data.folders,folder=>folderLabel(folder,library));const fullPath=(id:string)=>`${data.archives.find(item=>item.id===data.folders.find(folder=>folder.id===id)?.archive_id)?.name??""} / ${path(id)}`;
 const searching=Boolean(query.trim());const needle=query.trim().toLocaleLowerCase();const folders=data.folders.filter(folder=>searching?fullPath(folder.id).toLocaleLowerCase().includes(needle):folder.archive_id===archiveId&&folder.parent_id===(current?.id??null));
 return <div className="grid min-w-0 gap-2">
  <nav aria-label={t("folderPath")} className="flex min-w-0 items-center gap-2">
   <Button size="icon" variant="outline" disabled={busy||!current} aria-label={t("folderUp")} onClick={()=>current?.parent_id?selection.openFolder(current.parent_id):selection.selectArchive(archiveId)}><ArrowUp aria-hidden className="size-4"/></Button>
   <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto text-sm">
    {archive&&<InteractiveButton disabled={busy} className="min-h-11 shrink-0 px-2 text-primary" onClick={()=>selection.selectArchive(archiveId)}>{archive.name}</InteractiveButton>}
    {parents.map(folder=><span key={folder.id} className="inline-flex shrink-0 items-center gap-1"><span>/</span><InteractiveButton disabled={busy} className="min-h-11 max-w-48 truncate px-2 text-primary" title={folderLabel(folder,library)} onClick={()=>selection.openFolder(folder.id)}>{folderLabel(folder,library)}</InteractiveButton></span>)}
   </div>
  </nav>
  <div role="list" aria-label={t(searching?"folderSearchResults":"folderChildren")} className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-border-subtle p-2">
   {folders.map(folder=><div key={folder.id} role="listitem"><InteractiveButton type="button" data-destination-folder={folder.id} disabled={busy} title={fullPath(folder.id)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-2 py-2 text-start text-sm hover:bg-surface-interactive" onClick={()=>selection.openFolder(folder.id)}><Folder aria-hidden className="size-4 shrink-0"/><span className="min-w-0 break-words [overflow-wrap:anywhere]">{searching?fullPath(folder.id):folderLabel(folder,library)}</span></InteractiveButton></div>)}
   {!folders.length&&<p className="p-3 text-sm text-content-muted">{t(searching?"folderNoResults":current?"folderNoChildren":"folderChooseArchive")}</p>}
  </div>
  {current&&<p data-destination-path className="break-words text-sm text-content-muted [overflow-wrap:anywhere]">{t("folderSelected",{path:fullPath(current.id)})}</p>}
 </div>;
}
