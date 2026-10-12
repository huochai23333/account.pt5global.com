"use client";
import {useState} from "react";
import {ChevronRight,Folder} from "lucide-react";
import {InteractiveButton} from "@/components/ui/button";
import {useTranslations} from "next-intl";
import type {DocumentFolder} from "@/lib/document-library/model";
import type {SaveAsBrowser} from "./use-save-as-browser";
/** 展开状态留在目录树自身，文件区查询和加载不会卸载它；只显示服务端授权的目录。 */
export function SaveAsTree({browser,busy}:{browser:SaveAsBrowser;busy:boolean}){
 const t=useTranslations("CompanyTemplates.documents");const library=useTranslations("Documents");const [expanded,setExpanded]=useState<Map<string,boolean>>(()=>new Map());const ancestors=new Set<string>();let current=browser.folder;while(current&&!ancestors.has(current.id)){ancestors.add(current.id);current=browser.data.folders.find(f=>f.id===current?.parent_id);}
 function branch(folder:DocumentFolder,depth:number){const children=browser.data.folders.filter(f=>f.parent_id===folder.id);const open=expanded.get(folder.id)??ancestors.has(folder.id);const name=folder.system_key?browser.data.archives.find(a=>a.id===folder.archive_id)?.name??library("zones.personal"):folder.name;
  return <li key={folder.id} role="treeitem" aria-selected={folder.id===browser.folderId} aria-expanded={children.length?open:undefined}><div className={`flex min-w-0 items-center rounded-md ${folder.id===browser.folderId?"bg-surface-interactive text-primary":""}`} style={{paddingInlineStart:depth*10}}>
   <InteractiveButton aria-label={t("folderExpand",{name})} disabled={busy||!children.length} className="min-h-11 shrink-0 px-1" onClick={()=>setExpanded(new Map(expanded).set(folder.id,!open))}><ChevronRight aria-hidden className={`size-4 ${open?"rotate-90":""} ${children.length?"":"invisible"}`}/></InteractiveButton>
   <InteractiveButton data-save-as-tree-folder={folder.id} title={name} disabled={busy} className="flex min-h-11 min-w-0 flex-1 items-center gap-1 px-1 text-start text-sm" onClick={()=>browser.navigate(folder.id)}><Folder aria-hidden className="size-4 shrink-0"/><span className="min-w-0 truncate">{name}</span></InteractiveButton>
  </div>{children.length&&open?<ul role="group">{children.map(f=>branch(f,depth+1))}</ul>:null}</li>;
 }
 return <aside className="min-h-0 min-w-0 overflow-y-auto border-e border-border-subtle pe-2"><ul role="tree" aria-label={t("saveAsTree")}>{browser.data.folders.filter(f=>!f.parent_id).sort((a,b)=>Number(browser.data.archives.find(x=>x.id===b.archive_id)?.user_id===browser.data.userId)-Number(browser.data.archives.find(x=>x.id===a.archive_id)?.user_id===browser.data.userId)).map(f=>branch(f,0))}</ul></aside>;
}
