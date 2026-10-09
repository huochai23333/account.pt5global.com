"use client";
import {useState} from "react";
import {InteractiveButton} from "@/components/ui/button";
import {useTranslations} from "next-intl";
import {ChevronRight,Folder,FolderOpen,Home,Users,UserRound} from "lucide-react";
import type {ExplorerLibrary,DocumentSelection,DocumentFolder,ExplorerTarget} from "@/lib/document-library/model";
import {folderLabel} from "./folder-label";
import {folderSubject} from "./explorer-helpers";
/** 折叠只影响显示，目录是否可见由服务器授权决定；拖放只发出移动意图。 */
export function ExplorerTree({data,userId,navigate,move,disabled}:{userId:string;data:ExplorerLibrary;navigate:(s:DocumentSelection)=>void;move:(items:ExplorerTarget[],folder:DocumentFolder)=>void;disabled:boolean}){
 const t=useTranslations("Documents");const [expanded,setExpanded]=useState<Set<string>>(()=>{const ids=new Set(data.folders.filter(f=>f.system_key).map(f=>f.id));let parent=data.folders.find(f=>f.id===data.folderId);while(parent&&!ids.has(parent.id)){ids.add(parent.id);parent=data.folders.find(f=>f.id===parent?.parent_id);}return ids;});
 function branch(folder:DocumentFolder,depth:number){
  const children=data.folders.filter(f=>f.parent_id===folder.id);const open=expanded.has(folder.id);const active=folder.id===data.folderId;
  return <li key={folder.id} role="treeitem" aria-expanded={children.length?open:undefined} aria-selected={active}>
   <div className={`flex min-w-0 items-center rounded-lg ${active?"bg-surface-interactive text-primary":""}`} style={{paddingInlineStart:depth*12}}>
    <InteractiveButton type="button" aria-label={t(open?"explorer.collapse":"explorer.expand",{name:folderLabel(folder,t)})} disabled={disabled||!children.length} className="flex min-h-11 w-9 shrink-0 items-center justify-center" onClick={()=>setExpanded(prev=>{const next=new Set(prev);if(open)next.delete(folder.id);else next.add(folder.id);return next;})}><ChevronRight aria-hidden className={`size-4 ${open?"rotate-90":""} ${children.length?"":"invisible"}`}/></InteractiveButton>
    <InteractiveButton type="button" title={folderLabel(folder,t)} disabled={disabled} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-start text-sm" onClick={()=>navigate({...folderSubject(data),scope:"folder",folder:folder.id})}
     onDragOver={event=>{if(folder.can_manage&&!disabled)event.preventDefault();}} onDrop={event=>{event.preventDefault();if(disabled||!folder.can_manage)return;try{const items=JSON.parse(event.dataTransfer.getData("application/pt5-documents"));if(Array.isArray(items))move(items,folder);}catch{/* 外部文件由文件区上传入口处理。 */}}}>
     {active?<FolderOpen aria-hidden className="size-4 shrink-0"/>:<Folder aria-hidden className="size-4 shrink-0"/>}<span className="truncate">{folderLabel(folder,t)}</span>
    </InteractiveButton>
   </div>{children.length&&open?<ul role="group">{children.map(f=>branch(f,depth+1))}</ul>:null}
  </li>;
 }
 const hasEmployees=data.archives.some(a=>a.kind==="employee"&&a.user_id!==userId);
 const hasCustomers=data.archives.some(a=>a.kind==="customer"&&a.user_id!==userId);
 return <aside className="min-w-0 border-b border-border-subtle pb-3 lg:border-b-0 lg:border-e lg:pe-3"><nav aria-label={t("explorer.locations")} className="flex flex-wrap gap-1 lg:flex-col">
  {([{scope:"home",label:"home",icon:Home},...(hasEmployees?[{scope:"employees",label:"employees",icon:Users}]:[]),...(hasCustomers?[{scope:"customers",label:"customers",icon:UserRound}]:[])] as const).map(item=><InteractiveButton key={item.scope} type="button" disabled={disabled} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-start text-sm hover:bg-surface-interactive" onClick={()=>navigate({scope:item.scope as DocumentSelection["scope"]})}><item.icon aria-hidden className="size-4"/>{t(`explorer.${item.label}`)}</InteractiveButton>)}
 </nav>{(data.scope==="archive"||data.scope==="folder")&&<ul role="tree" aria-label={t("folders")} className="hidden lg:block">{data.folders.filter(f=>!f.parent_id).map(f=>branch(f,0))}</ul>}</aside>;
}
