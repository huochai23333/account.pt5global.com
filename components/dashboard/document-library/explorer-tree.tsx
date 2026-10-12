"use client";
import {useState,useCallback} from "react";
import {InteractiveButton} from "@/components/ui/button";
import {useTranslations} from "next-intl";
import {ChevronRight,Folder,FolderOpen,Home,Users,UserRound} from "lucide-react";
import type {ExplorerLibrary,DocumentSelection,DocumentFolder,ExplorerTarget} from "@/lib/document-library/model";
import {folderLabel} from "./folder-label";
import {folderSubject} from "./explorer-helpers";
import {ExplorerMenu} from "./explorer-menu";
import type {ExplorerAction} from "./explorer-toolbar";
/** 折叠只影响显示，目录是否可见由服务器授权决定；拖放只发出移动意图。 */
export function ExplorerTree({data,userId,navigate,move,disabled,action,canPaste}:{userId:string;data:ExplorerLibrary;navigate:(s:DocumentSelection)=>void;move:(items:ExplorerTarget[],folder:DocumentFolder)=>void;disabled:boolean;canPaste:boolean;action:(name:ExplorerAction,items:import("@/lib/document-library/model").ExplorerItem[],folder?:DocumentFolder)=>void}){
 const t=useTranslations("Documents");const [expanded,setExpanded]=useState<Map<string,boolean>>(()=>new Map());
 const [menu,setMenu]=useState<{folder:DocumentFolder;x:number;y:number}|null>(null);const closeMenu=useCallback(()=>setMenu(null),[]);
 function showMenu(folder:DocumentFolder,x:number,y:number){if(!disabled)setMenu({folder,x:Math.max(8,Math.min(x,window.innerWidth-224)),y:Math.max(8,Math.min(y,window.innerHeight-340))});}
 // 当前路径默认展开，手动折叠按目录编号保留；重新查询不会卸载目录树。
 const ancestors=new Set<string>();let parent=data.folders.find(f=>f.id===data.folderId);while(parent&&!ancestors.has(parent.id)){ancestors.add(parent.id);parent=data.folders.find(f=>f.id===parent?.parent_id);}

 function branch(folder:DocumentFolder,depth:number){
  const children=data.folders.filter(f=>f.parent_id===folder.id);const open=expanded.get(folder.id)??(Boolean(folder.system_key)||ancestors.has(folder.id));const active=folder.id===data.folderId;
  return <li key={folder.id} role="treeitem" aria-expanded={children.length?open:undefined} aria-selected={active}>
   <div className={`flex min-w-0 items-center rounded-lg ${active?"bg-surface-interactive text-primary":""}`} style={{paddingInlineStart:depth*12}} onContextMenu={event=>{event.preventDefault();event.stopPropagation();showMenu(folder,event.clientX,event.clientY);}} onKeyDown={event=>{if(event.key==="ContextMenu"||(event.shiftKey&&event.key==="F10")){event.preventDefault();const box=event.currentTarget.getBoundingClientRect();showMenu(folder,box.left,box.bottom);}}}>
    <InteractiveButton type="button" aria-label={t(open?"explorer.collapse":"explorer.expand",{name:folderLabel(folder,t)})} disabled={!children.length} className="flex min-h-11 w-9 shrink-0 items-center justify-center" onClick={()=>setExpanded(prev=>{const next=new Map(prev);next.set(folder.id,!open);return next;})}><ChevronRight aria-hidden className={`size-4 ${open?"rotate-90":""} ${children.length?"":"invisible"}`}/></InteractiveButton>
    <InteractiveButton type="button" title={folderLabel(folder,t)} disabled={disabled} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 px-2 text-start text-sm" onClick={()=>navigate({...folderSubject(data),scope:"folder",folder:folder.id})}
     onDragOver={event=>{if(folder.can_manage&&!disabled)event.preventDefault();}} onDrop={event=>{event.preventDefault();if(disabled||!folder.can_manage)return;try{const items=JSON.parse(event.dataTransfer.getData("application/pt5-documents"));if(Array.isArray(items))move(items,folder);}catch{/* 外部文件由文件区上传入口处理。 */}}}>
     {active?<FolderOpen aria-hidden className="size-4 shrink-0"/>:<Folder aria-hidden className="size-4 shrink-0"/>}<span className="truncate">{folderLabel(folder,t)}</span>
    </InteractiveButton>
   </div>{children.length&&open?<ul role="group">{children.map(f=>branch(f,depth+1))}</ul>:null}
  </li>;
 }
 const hasEmployees=data.archives.some(a=>a.kind==="employee"&&a.user_id!==userId);
 const hasCustomers=data.archives.some(a=>a.kind==="customer"&&a.user_id!==userId);
 // 目录树空白处也接管右键，以当前目录（首页则为个人根目录）作为新建和粘贴位置。
 return <aside className="min-h-0 min-w-0 overflow-y-auto border-b border-border-subtle pb-3 lg:border-b-0 lg:border-e lg:pe-3" onContextMenu={event=>{event.preventDefault();event.stopPropagation();const folder=data.folders.find(item=>item.id===data.folderId)??data.folders.find(item=>item.can_manage&&item.system_key);if(folder)showMenu(folder,event.clientX,event.clientY);}}><nav aria-label={t("explorer.locations")} className="flex flex-wrap gap-1 lg:flex-col">
  {([{scope:"home",label:"home",icon:Home},...(hasEmployees?[{scope:"employees",label:"employees",icon:Users}]:[]),...(hasCustomers?[{scope:"customers",label:"customers",icon:UserRound}]:[])] as const).map(item=><InteractiveButton key={item.scope} type="button" disabled={disabled} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-start text-sm hover:bg-surface-interactive" onClick={()=>navigate({scope:item.scope as DocumentSelection["scope"]})}><item.icon aria-hidden className="size-4"/>{t(`explorer.${item.label}`)}</InteractiveButton>)}
 </nav>{(data.scope==="archive"||data.scope==="folder")&&<ul role="tree" aria-label={t("folders")} className="hidden lg:block">{data.folders.filter(f=>!f.parent_id).map(f=>branch(f,0))}</ul>}{menu&&<ExplorerMenu item={{kind:"folder",id:menu.folder.id,name:menu.folder.name,folder:menu.folder,path:[],canManage:menu.folder.can_manage}} count={1} manageable={menu.folder.can_manage&&!menu.folder.system_key} canCreate={menu.folder.can_manage} canNewDocument={menu.folder.can_manage} canPaste={canPaste&&menu.folder.can_manage} folderContext position={menu} close={closeMenu} action={name=>action(name,[{kind:"folder",id:menu.folder.id,name:menu.folder.name,folder:menu.folder,path:[],canManage:menu.folder.can_manage}],menu.folder)}/>}</aside>;
}
