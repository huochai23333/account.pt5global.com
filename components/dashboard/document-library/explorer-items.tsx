"use client";
import {useState,useCallback} from "react";
import {InteractiveButton} from "@/components/ui/button";
import {useTranslations,useLocale} from "next-intl";
import {Folder,FileText,Image as ImageIcon,File,MoreHorizontal} from "lucide-react";
import type {ExplorerItem,ExplorerLibrary,ExplorerTarget,DocumentFolder} from "@/lib/document-library/model";
import {Checkbox,ChoiceField} from "@/components/ui/form-controls";
import {folderLabel} from "./folder-label";
import {explorerTarget,folderPath,itemDate,itemManageable} from "./explorer-helpers";
import {ExplorerMenu} from "./explorer-menu";
import type {ExplorerAction} from "./explorer-toolbar";
/** 文件夹和两类文档统一显示；列表不承载查询或写入逻辑。 */
export function ExplorerItems({data,searching,view,ids,selected,select,toggleAll,open,action,move,busy}:{data:ExplorerLibrary;searching:boolean;view:"list"|"grid";ids:Set<string>;selected:ExplorerItem[];select:(id:string,ctrl?:boolean,shift?:boolean)=>void;toggleAll:()=>void;open:(item:ExplorerItem)=>void;action:(a:ExplorerAction,items:ExplorerItem[])=>void;move:(items:ExplorerTarget[],folder:DocumentFolder)=>void;busy:boolean}){
 const t=useTranslations("Documents");const locale=useLocale();const [menu,setMenu]=useState<{item:ExplorerItem;x:number;y:number}|null>(null);const closeMenu=useCallback(()=>setMenu(null),[]);
 function showMenu(item:ExplorerItem,x:number,y:number){if(!ids.has(item.id))select(item.id);setMenu({item,x:Math.max(8,Math.min(x,window.innerWidth-224)),y:Math.max(8,Math.min(y,window.innerHeight-340))});}
 function displayName(item:ExplorerItem){return item.kind==="location"?t(`explorer.${item.name}`):item.kind==="folder"?folderLabel(item.folder,t):item.name;}
 function type(item:ExplorerItem){return item.kind==="folder"||item.kind==="location"||item.kind==="archive"?t("explorer.folderType"):item.kind==="template"?t("explorer.templateType"):item.kind==="file"?item.file.name.split(".").pop()?.toUpperCase()??t("explorer.fileType"):t("explorer.folderType");}
 if(!data.items.length)return <div className="rounded-xl border border-dashed border-border-subtle p-10 text-center text-content-muted">{t(searching?"explorer.noResults":"empty")}</div>;
 return <div className="min-w-0 space-y-2">
 <ChoiceField type="checkbox" label={t("explorer.selectAll")} aria-label={t("explorer.selectAll")} disabled={busy} checked={ids.size===data.items.length} onChange={toggleAll}/>
 {view==="list"&&<div aria-hidden className="hidden grid-cols-[minmax(0,1fr)_100px_140px_90px] gap-3 border-b border-border-subtle px-12 pb-2 text-xs text-content-muted xl:grid"><span>{t("name")}</span><span>{t("explorer.type")}</span><span>{t("explorer.date")}</span><span>{t("explorer.size")}</span></div>}
 <div role="list" aria-label={t("explorer.contents")} className={view==="grid"?"grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5":"grid min-w-0 gap-1"}>
 {data.items.map(item=>{
  const folder=item.kind==="folder"||item.kind==="location"||item.kind==="archive";const Icon=folder?Folder:item.kind==="template"?FileText:item.kind==="file"&&item.file.mime_type.startsWith("image/")?ImageIcon:File;
  const targets=(ids.has(item.id)?selected:[item]).filter(itemManageable).map(explorerTarget).filter((value):value is ExplorerTarget=>value!==null);
  const date=itemDate(item);const name=displayName(item);
  return <article role="listitem" tabIndex={busy?-1:0} key={item.id} data-explorer-item={item.id} data-explorer-kind={item.kind} {...(item.kind==="file"?{"data-document-file":item.id}:item.kind==="template"?{"data-template-document":item.id}:{})}
   aria-label={name} aria-current={ids.has(item.id)?"true":undefined} draggable={!busy&&itemManageable(item)}
   className={`relative min-w-0 rounded-lg border p-3 outline-offset-2 ${ids.has(item.id)?"border-primary bg-surface-interactive":"border-transparent hover:border-border-subtle hover:bg-surface-interactive"} ${view==="grid"?"space-y-3":"flex items-center gap-3"}`}
   onClick={event=>{if(!busy)select(item.id,event.ctrlKey||event.metaKey,event.shiftKey);}} onDoubleClick={()=>{if(!busy)open(item);}}
   onKeyDown={event=>{if(event.key==="ContextMenu"||(event.shiftKey&&event.key==="F10")){event.preventDefault();const box=event.currentTarget.getBoundingClientRect();showMenu(item,box.left,box.bottom);}}}
   onContextMenu={event=>{event.preventDefault();if(!busy)showMenu(item,event.clientX,event.clientY);}}
   onDragStart={event=>{if(busy||!targets.length){event.preventDefault();return;}event.dataTransfer.setData("application/pt5-documents",JSON.stringify(targets));event.dataTransfer.effectAllowed="move";}}
   onDragOver={event=>{if(!busy&&item.kind==="folder"&&item.canManage&&event.dataTransfer.types.includes("application/pt5-documents")){event.preventDefault();event.dataTransfer.dropEffect="move";}}}
   onDrop={event=>{if(busy||item.kind!=="folder"||!item.canManage||!event.dataTransfer.types.includes("application/pt5-documents"))return;event.preventDefault();event.stopPropagation();try{const payload=JSON.parse(event.dataTransfer.getData("application/pt5-documents"));if(Array.isArray(payload))move(payload,item.folder);}catch{/* 不执行来源不明的拖放内容。 */}}}>
   <Checkbox aria-label={t("explorer.selectItem",{name})} checked={ids.has(item.id)} disabled={busy} className={`size-4 shrink-0 ${view==="grid"?"absolute start-3 top-3":""}`} onClick={event=>event.stopPropagation()} onChange={()=>select(item.id,true)}/>
   <Icon aria-hidden className={`${view==="grid"?"mx-auto size-12":"size-6 shrink-0"} ${folder?"text-primary":"text-content-muted"}`}/>
   <div className="min-w-0 flex-1"><p title={name} className="line-clamp-2 break-words text-sm font-medium [overflow-wrap:anywhere]">{name}</p>{searching&&"path" in item&&(data.scope==="folder"||data.scope==="archive"||data.scope==="home")&&item.path.length>0&&<p className="mt-1 break-words text-xs text-content-muted [overflow-wrap:anywhere]">{data.archives.find(a=>a.id===data.folders.find(f=>f.id===item.path.at(-1))?.archive_id)?.name} / {folderPath(item.kind==="folder"?item.folder.parent_id??item.folder.id:item.path.at(-1)??"",data.folders,f=>folderLabel(f,t))}</p>}
    <p className="mt-1 text-xs text-content-muted xl:hidden">{type(item)}</p></div>
   {view==="list"&&<div className="hidden shrink-0 grid-cols-[100px_140px_90px] gap-3 text-xs text-content-muted xl:grid"><span>{type(item)}</span><span>{date?new Intl.DateTimeFormat(locale==="zh"?"zh-CN":"en-GB",{timeZone:"Asia/Shanghai"}).format(new Date(date)):"—"}</span><span>{item.kind==="file"?t("fileSize",{size:(item.file.size_bytes/1024).toFixed(1)}):"—"}</span></div>}
   <InteractiveButton aria-label={t("explorer.itemMore",{name})} type="button" disabled={busy} className={`flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-surface-panel ${view==="grid"?"absolute end-1 top-1":""}`} onClick={event=>{event.stopPropagation();const box=event.currentTarget.getBoundingClientRect();showMenu(item,box.left,box.bottom);}}><MoreHorizontal aria-hidden className="size-4"/></InteractiveButton>
  </article>;
 })}</div>{menu&&<ExplorerMenu item={menu.item} manageable={(ids.has(menu.item.id)?selected:[menu.item]).every(itemManageable)} count={ids.has(menu.item.id)?selected.length:1} position={menu} close={closeMenu} action={a=>action(a,ids.has(menu.item.id)?selected:[menu.item])}/>}
 </div>;
}
