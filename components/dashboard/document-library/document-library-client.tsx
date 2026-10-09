"use client";
import {useTranslations} from "next-intl";
import {Button} from "@/components/ui/button";
import type {ExplorerLibrary,DocumentSelection} from "@/lib/document-library/model";
import {ExplorerTree} from "./explorer-tree";
import {ExplorerToolbar} from "./explorer-toolbar";
import {ExplorerItems} from "./explorer-items";
import {ExplorerDialog} from "./explorer-dialog";
import {ExplorerBatchResults} from "./explorer-batch-results";
import {useExplorerController} from "./use-explorer-controller";
import {itemManageable} from "./explorer-helpers";
import {DocumentUploadResults} from "./document-upload-results";
import {DocumentPendingOperations} from "./document-pending-operations";
/** 页面只组装文件管理器；目录、选择、弹窗、上传与批量凭证各有独立模块。 */
export function DocumentLibraryClient({initial,selection:initialSelection,userId}:{initial:ExplorerLibrary|null;selection:DocumentSelection;userId:string}){
 const t=useTranslations("Documents");const c=useExplorerController(initial,initialSelection,userId);const {data,selection,loading,error}=c.library;const {single,batches}=c.operations;
 const known=["folderNameConflict","forbidden","invalid","size","archiveSize","templateDownload","busy","conflict","partial","unconfirmed"];
 const visibleBatches=data?.batches.filter(b=>b.id!==batches.batch?.id)??[];
 if(batches.batch)visibleBatches.unshift({...batches.batch,total:batches.batch.manifest.length});
 return <section tabIndex={0} className="min-w-0 space-y-4 p-4 sm:p-6" onKeyDown={c.keyboard}>
  <h1 className="text-2xl font-bold">{t("title")}</h1>
  {single.message&&<p role="status" data-document-result={single.successful?"succeeded":single.message==="partial"?"partial_failed":"failed"} className={single.successful?"text-status-success":"text-status-danger"}>{t(`errors.${single.message}`)}</p>}
  {c.operations.error&&<p role="alert" className="text-status-danger">{t(`errors.${known.includes(c.operations.error)?c.operations.error:"unconfirmed"}`)}</p>}
  {error&&<div role="alert" className="space-y-2"><p>{t(`errors.${known.includes(error)?error:"unconfirmed"}`)}</p><Button onClick={()=>c.navigate({scope:"home"})}>{t("explorer.home")}</Button></div>}
  {loading&&<p role="status">{t("loading")}</p>}
  <DocumentUploadResults results={single.uploadResults}/>
  {data&&<div className="grid min-w-0 gap-4 rounded-xl border border-border-subtle bg-surface-panel p-3 lg:grid-cols-[220px_minmax(0,1fr)]">
   <ExplorerTree data={data} userId={userId} navigate={c.navigate} move={c.move} disabled={c.busy}/>
   <div className="min-w-0 space-y-3">
    <ExplorerToolbar data={data} selection={selection} view={c.view} setView={c.setView} navigate={c.navigate} refresh={()=>void c.library.refresh()} action={c.action} upload={files=>void single.upload(data.folderId!,files)} selected={c.selection.selected.length} manageable={c.selection.selected.every(itemManageable)} canPaste={c.selection.cut.length>0} downloadable={c.selection.selected.every(item=>"path" in item)} busy={c.busy}/>
    <div className={`min-h-64 min-w-0 rounded-lg ${c.dragging?"outline-2 outline-dashed outline-primary":""}`} onDragOver={c.dragOver} onDragLeave={event=>{if(!event.currentTarget.contains(event.relatedTarget as Node))c.setDragging(false);}} onDrop={c.drop}>
     {c.dragging&&<p className="p-3 text-primary">{t("explorer.dropUpload")}<span className="block text-sm">{t("limits")}</span></p>}
     <ExplorerItems data={data} searching={Boolean(selection.query)} view={c.view} ids={c.selection.ids} selected={c.selection.selected} select={c.selection.select} toggleAll={c.selection.toggleAll} open={c.open} action={c.action} move={c.move} busy={c.busy}/>
    </div>
    <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-3"><Button variant="outline" disabled={c.busy||(selection.page??1)<=1} onClick={()=>{c.selection.clear();void c.library.load({...selection,page:(selection.page??1)-1},true);}}>{t("previous")}</Button><span className="text-sm text-content-muted">{t("pagination",{page:selection.page??1,total:data.total})}</span><Button variant="outline" disabled={c.busy||(selection.page??1)*20>=data.total} onClick={()=>{c.selection.clear();void c.library.load({...selection,page:(selection.page??1)+1},true);}}>{t("next")}</Button></div>
    <DocumentPendingOperations receipts={data.operations} intents={single.outstanding} busy={c.busy} reconcile={receipt=>void single.reconcile(receipt)}/>
   </div>
  </div>}
  <ExplorerBatchResults batches={visibleBatches} busy={c.busy} resume={id=>void batches.resume(id)} release={id=>void batches.release(id)}/>
  {c.dialog&&<ExplorerDialog target={c.dialog} busy={c.busy} close={()=>c.setDialog(null)} submit={c.submit}/>}
 </section>;
}
