"use client";
import {useEffect,useRef} from "react";
import {useTranslations} from "next-intl";
import {ArrowLeft,ArrowRight,ArrowUp,LayoutGrid,List,RefreshCw} from "lucide-react";
import {Button,InteractiveButton} from "@/components/ui/button";
import {Input} from "@/components/ui/form-controls";
import {Select} from "@/components/ui/select";
import {DashboardFilePicker} from "@/components/dashboard/dashboard-framework-primitives";
import {DOCUMENT_ACCEPT} from "@/lib/document-library/browser-policy";
import type {ExplorerLibrary,DocumentSelection,DocumentFolder} from "@/lib/document-library/model";
import {folderLabel} from "./folder-label";
import {folderSubject} from "./explorer-helpers";
export type ExplorerAction="open"|"rename"|"move"|"delete"|"copy"|"download"|"cut"|"paste"|"create";
/** 工具栏只调度；选择与写入状态分别由专用 hook 维护。 */
export function ExplorerToolbar({data,selection,view,setView,navigate,refresh,action,upload,selected,manageable,canPaste,downloadable,busy}:{data:ExplorerLibrary;selection:DocumentSelection;view:"list"|"grid";setView:(v:"list"|"grid")=>void;navigate:(s:DocumentSelection)=>void;refresh:()=>void;action:(a:ExplorerAction)=>void;upload:(files:File[])=>void;selected:number;manageable:boolean;canPaste:boolean;downloadable:boolean;busy:boolean}){
 const t=useTranslations("Documents");const folder=data.folders.find(f=>f.id===data.folderId);const archive=data.archives.find(a=>a.id===data.archiveId);const parents:DocumentFolder[]=[];let current=folder;const seen=new Set<string>();
 while(current&&!seen.has(current.id)){seen.add(current.id);parents.unshift(current);current=data.folders.find(f=>f.id===current?.parent_id);}
 const subject=folderSubject(data);const pathRef=useRef<HTMLElement>(null);
 // 长路径在自己的区域滚动，进入目录后显示末端；完整名称仍可读且各级均可点击。
 useEffect(()=>{const path=pathRef.current;if(!path)return;const scroll=()=>{path.scrollLeft=path.scrollWidth;};scroll();const observer=new ResizeObserver(scroll);observer.observe(path);return()=>observer.disconnect();},[data.folderId]);
 function up(){if(folder?.parent_id)navigate({...subject,scope:"folder",folder:folder.parent_id});else if(folder)navigate({...subject,scope:"archive"});else navigate({scope:"home"});}
 return <div className="space-y-3 border-b border-border-subtle pb-3">
 <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap">
  <Button size="icon" variant="outline" aria-label={t("explorer.back")} disabled={busy} onClick={()=>window.history.back()}><ArrowLeft aria-hidden className="size-4"/></Button>
  <Button size="icon" variant="outline" aria-label={t("explorer.forward")} disabled={busy} onClick={()=>window.history.forward()}><ArrowRight aria-hidden className="size-4"/></Button>
  <Button size="icon" variant="outline" aria-label={t("explorer.up")} disabled={busy||data.scope==="home"} onClick={up}><ArrowUp aria-hidden className="size-4"/></Button>
  {/* 桌面路径从剩余宽度分配，长名称只在路径内滚动，避免把导航按钮挤成三行。 */}
  <nav ref={pathRef} aria-label={t("explorer.path")} className="order-last flex basis-full min-w-0 flex-nowrap items-center gap-1 overflow-x-auto text-sm lg:order-none lg:basis-0 lg:flex-1">
   <InteractiveButton className="min-h-11 shrink-0 rounded px-2 text-primary" disabled={busy} onClick={()=>navigate({scope:"home"})}>{t("title")}</InteractiveButton>
   {(data.scope==="employees"||data.scope==="customers")&&<span>/ {t(`explorer.${data.scope}`)}</span>}
   {(data.scope==="archive"||data.scope==="folder")&&<><span>/</span><InteractiveButton title={archive?.name} className="min-h-11 max-w-48 shrink-0 truncate whitespace-nowrap rounded px-2 text-primary" disabled={busy} onClick={()=>navigate({...subject,scope:"archive"})}>{archive?.name}</InteractiveButton>{parents.map(f=><span key={f.id} className="inline-flex shrink-0 items-center gap-1"><span>/</span><InteractiveButton title={folderLabel(f,t)} className="min-h-11 max-w-48 truncate whitespace-nowrap rounded px-2 text-primary" disabled={busy} onClick={()=>navigate({...subject,scope:"folder",folder:f.id})}>{folderLabel(f,t)}</InteractiveButton></span>)}</>}
  </nav>
  <Button size="icon" aria-label={t("explorer.refresh")} variant="outline" disabled={busy} onClick={refresh}><RefreshCw aria-hidden className="size-4"/></Button>
 </div>
 <div className="flex min-w-0 flex-wrap items-center gap-2">
  <form className="flex min-w-0 flex-1 basis-full gap-2 xl:basis-0" onSubmit={event=>{event.preventDefault();navigate({...selection,query:String(new FormData(event.currentTarget).get("query")??"")});}}><Input className="min-w-0 flex-1" key={selection.query??""} name="query" defaultValue={selection.query??""} placeholder={t(data.scope==="employees"||data.scope==="customers"?"explorer.archiveSearch":"explorer.searchPlaceholder")} aria-label={t("search")} maxLength={200}/><Button type="submit" variant="outline" disabled={busy}>{t("search")}</Button></form>
  <Select className="w-28 shrink-0 sm:w-36" aria-label={t("explorer.sort")} value={selection.sort??"name"} disabled={busy} options={["name","type","date"].map(value=>({value,label:t(`explorer.sort_${value}`)}))} onValueChange={value=>navigate({...selection,sort:value as DocumentSelection["sort"]})}/>
  <Button variant="outline" disabled={busy} onClick={()=>navigate({...selection,direction:selection.direction==="desc"?"asc":"desc"})}>{t(selection.direction==="desc"?"explorer.desc":"explorer.asc")}</Button>
  <Button size="icon" variant="outline" aria-label={t(view==="list"?"explorer.gridView":"explorer.listView")} onClick={()=>setView(view==="list"?"grid":"list")}>{view==="list"?<LayoutGrid aria-hidden className="size-4"/>:<List aria-hidden className="size-4"/>}</Button>
 </div>
 {/* 选中后不能换行推走条目，否则双击的第二次点击会落到别处；固定高度也容纳横向滚动条。 */}
 <div className="flex h-16 min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain">
  {data.canManage&&<><div className="shrink-0" title={t("limits")}><DashboardFilePicker accept={DOCUMENT_ACCEPT} multiple disabled={busy} label={t("upload")} onFiles={upload}/></div><Button variant="outline" disabled={busy} onClick={()=>action("create")}>{t("create_folder")}</Button></>}
  <span className="shrink-0 whitespace-nowrap text-sm text-content-muted">{t("explorer.selected",{count:selected})}</span>
  {/* 批量按钮按选择出现，空间不足时在本行滚动，不改变文件区位置。 */}
  {selected>0&&<><Button variant="outline" disabled={busy||!selected||!downloadable} onClick={()=>action("download")}>{t("download")}</Button>
  <Button variant="outline" disabled={busy||!selected||!manageable} onClick={()=>action("cut")}>{t("explorer.cut")}</Button>
  <Button variant="outline" disabled={busy||!selected||!manageable} onClick={()=>action("move")}>{t("explorer.move")}</Button>
  <Button variant="outline" disabled={busy||!selected||!manageable} onClick={()=>action("delete")}>{t("explorer.delete")}</Button>
  <Button variant="outline" disabled={busy||selected!==1||!manageable} onClick={()=>action("rename")}>{t("explorer.rename")}</Button></>}
  {canPaste&&data.canManage&&<Button variant="outline" disabled={busy} onClick={()=>action("paste")}>{t("explorer.paste")}</Button>}
  {!data.canManage&&data.scope==="folder"&&<span className="text-sm text-content-muted">{t("readOnly")}</span>}
 </div></div>;
}
