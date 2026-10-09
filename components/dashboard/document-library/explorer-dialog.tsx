"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import {useTranslations} from "next-intl";
import {DashboardDialog} from "@/components/dashboard/dashboard-dialog";
import {Button} from "@/components/ui/button";
import {Input,Field,ChoiceField} from "@/components/ui/form-controls";
import {Select} from "@/components/ui/select";
import type {DocumentManifest,ExplorerTarget,ExplorerItem,DocumentFolder} from "@/lib/document-library/model";
import {useDocumentDestinations} from "@/components/dashboard/company-templates/documents/use-document-destinations";
import {folderLabel} from "./folder-label";
import {folderPath} from "./explorer-helpers";
export type ExplorerDialogTarget={action:"rename"|"move"|"delete"|"create"|"copy"|"preview"|"download";items:ExplorerTarget[];item?:ExplorerItem;folder?:DocumentFolder;destinationId?:string};
export type ExplorerDialogSubmission={name:string;destinationId:string;confirmShare:boolean;manifest:DocumentManifest|null;operationId:string};
/** 清单与目的地表单留在弹窗模块；共享必须明确勾选，失败保留原输入和原批次编号。 */
export function ExplorerDialog({target,busy,close,submit}:{target:ExplorerDialogTarget;busy:boolean;close:()=>void;submit:(value:ExplorerDialogSubmission)=>Promise<boolean>}){
 const t=useTranslations("Documents");const op=useRef<string>(crypto.randomUUID());const [name,setName]=useState(target.action==="copy"?`${target.item?.name??""} (2)`:target.item?.name??"");const [manifest,setManifest]=useState<DocumentManifest|null>(null);const [loading,setLoading]=useState(["move","delete","download"].includes(target.action));const [error,setError]=useState("");const [notice,setNotice]=useState(false);
 const sourceFolder=target.item?.kind==="file"?target.item.file.folder_id:target.item?.kind==="template"?target.item.document.folder_id:target.item?.kind==="folder"?target.item.folder.parent_id??undefined:undefined;
 // 默认展开来源档案；剪切粘贴和拖放则以用户刚进入的目的地为准。
 const needsDestination=target.action==="move"||target.action==="copy";const dest=useDocumentDestinations(target.destinationId??sourceFolder,needsDestination);const [destinationId,setDestinationId]=useState(target.destinationId??sourceFolder??"");const [confirmShare,setConfirmShare]=useState(false);
 const destination=dest.data.folders.find(f=>f.id===destinationId);const archive=dest.data.archives.find(a=>a.id===destination?.archive_id);const sharing=destination?.zone==="shared";
 const loadManifest=useCallback(async(signal?:AbortSignal)=>{
  if(!["move","delete","download"].includes(target.action))return;
  setLoading(true);setError("");setNotice(false);
  try{const response=await fetch("/api/document-library/manifest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:target.items,write:target.action!=="download"}),signal});const result=await response.json();if(!response.ok)throw new Error(result.error??"unconfirmed");if(!signal?.aborted)setManifest(result);}
  catch(cause){if(!signal?.aborted)setError(cause instanceof Error?cause.message:"unconfirmed");}finally{if(!signal?.aborted)setLoading(false);}
 },[target]);
 useEffect(()=>{const controller=new AbortController();void loadManifest(controller.signal);return()=>controller.abort();},[loadManifest]);
 const counts={folders:manifest?.entries.filter(e=>e.kind==="folder").length??0,files:manifest?.entries.filter(e=>e.kind==="file").length??0,templates:manifest?.entries.filter(e=>e.kind==="template").length??0};
 const preview=target.action==="preview"&&target.item?.kind==="file"?target.item.file:null;
 const forbiddenFolders=new Set(manifest?.entries.filter(e=>e.kind==="folder").map(e=>e.id));
 const destinations=dest.data.folders.filter(f=>!forbiddenFolders.has(f.id));
 const destinationValid=Boolean(destination)&&!forbiddenFolders.has(destinationId)&&!(target.action==="move"&&manifest?.entries.some(e=>e.path.length===1&&(e.kind==="folder"?e.record.parent_id===destinationId:e.folderId===destinationId)));
 const valid=!loading&&!busy&&(!needsDestination||destinationValid&&(!sharing||confirmShare))&&(!["rename","create","copy"].includes(target.action)||Boolean(name.trim()))&&(target.action!=="delete"||notice)&&(target.action!=="download"||counts.files>0||counts.folders>0);
 return <DashboardDialog open onOpenChange={open=>{if(!open&&!busy)close();}} title={t(target.action==="preview"?"preview":`explorer.${target.action}`)} actions={<><Button variant="outline" disabled={busy} onClick={close}>{t("cancel")}</Button>{!preview&&<Button disabled={!valid} onClick={async()=>{
  setError("");try{if(await submit({name,destinationId,confirmShare,manifest,operationId:op.current}))close();}catch(cause){const message=cause instanceof Error?cause.message:"unconfirmed";setError(message.startsWith("document_")?message.replace("document_",""):message);}
 }}>{busy?t("working"):t("confirm")}</Button>}</>}>
 {preview?<iframe title={preview.name} src={`/api/document-library/files/${preview.id}/content?preview=1`} className="h-[65vh] w-full rounded-lg border"/>:<div className="space-y-4">
  {loading&&<p role="status">{t("loading")}</p>}
  {["rename","create","copy"].includes(target.action)&&<Field label={t("name")}><Input autoFocus maxLength={target.item?.kind==="template"?120:200} disabled={busy} value={name} onChange={event=>setName(event.target.value)}/></Field>}
  {manifest&&<><p>{t("explorer.manifestCounts",counts)}</p><ul className="max-h-48 overflow-auto rounded-lg border border-border-subtle p-3 text-sm">{manifest.entries.filter(e=>e.path.length===1).map(e=><li className="break-words [overflow-wrap:anywhere]" key={`${e.kind}:${e.id}`}>{e.location?`${e.location.archiveName} / ${e.location.folders.map(f=>f.system_key?t(`zones.${f.zone}`):f.name).join(" / ")}${e.kind==="folder"?"":` / ${e.record.name}`}`:e.path.join(" / ")}</li>)}</ul></>}
  {target.action==="delete"&&<ChoiceField type="checkbox" disabled={busy} checked={notice} onChange={event=>setNotice(event.target.checked)} label={t("explorer.permanentDelete")}/>}
  {needsDestination&&<><Field label={t("explorer.archiveSearch")}><Input value={dest.query} onChange={event=>dest.setQuery(event.target.value)} disabled={busy}/></Field>
   <Field label={t("archive")}><Select aria-label={t("archive")} value={dest.archiveId||destination?.archive_id||""} disabled={busy||dest.loading} options={dest.data.archives.filter(a=>!dest.query||a.name.toLowerCase().includes(dest.query.toLowerCase())).map(a=>({value:a.id,label:a.name}))} onValueChange={id=>{dest.selectArchive(id);setDestinationId("");setConfirmShare(false);}}/></Field>
   <Field label={t("destination")}><Select aria-label={t("destination")} value={destinationId} disabled={busy||dest.loading} options={destinations.filter(f=>f.archive_id===(dest.archiveId||destination?.archive_id)).map(f=>({value:f.id,label:folderPath(f.id,dest.data.folders,f=>folderLabel(f,t))}))} onValueChange={id=>{setDestinationId(id);setConfirmShare(false);}}/></Field>
   {destination&&<p className="break-words text-sm [overflow-wrap:anywhere]">{t("explorer.destinationNotice",{path:`${archive?.name??""} / ${folderPath(destination.id,dest.data.folders,f=>folderLabel(f,t))}`})}</p>}
   {sharing&&<ChoiceField type="checkbox" label={t("explorer.share",{name:archive?.name??""})} checked={confirmShare} disabled={busy} onChange={event=>setConfirmShare(event.target.checked)}/>}
   {dest.error&&<p role="alert">{t("errors.unconfirmed")}</p>}
  </>}
  {target.action==="download"&&counts.templates>0&&<p>{t("explorer.templateDownloadNotice",{count:counts.templates})}</p>}
  {target.action==="download"&&<p className="text-sm text-content-muted">{t("explorer.zipLimits")}</p>}
  {error&&<div role="alert"><p className="text-status-danger">{t(`errors.${["folderNameConflict","forbidden","invalid","size","archiveSize","templateDownload","busy","conflict","folderNotEmpty","defaultFolder","shareConfirmation","partial","unconfirmed"].includes(error)?error:"unconfirmed"}`)}</p>{["move","delete","download"].includes(target.action)&&<Button variant="outline" disabled={busy} onClick={()=>void loadManifest()}>{t("explorer.reloadManifest")}</Button>}</div>}
 </div>}</DashboardDialog>;
}
