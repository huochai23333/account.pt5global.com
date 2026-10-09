"use client";
import {useState} from "react";
import type {ExplorerLibrary} from "@/lib/document-library/model";
import {useDocumentActions} from "./use-document-actions";
import {useExplorerBatches} from "./use-explorer-batches";
import type {ExplorerDialogTarget,ExplorerDialogSubmission} from "./explorer-dialog";
import {writeDocument} from "@/lib/company-templates/documents/client";
/** 单项写入复用原凭证链，批量写入使用持久化清单；两种方式都在完成后刷新真实位置。 */
export function useExplorerOperations(userId:string,data:ExplorerLibrary|null,refresh:()=>Promise<boolean>){
 const single=useDocumentActions(userId,refresh);const batches=useExplorerBatches(userId,refresh);const [downloading,setDownloading]=useState(false);const [downloadError,setDownloadError]=useState("");
 async function submit(target:ExplorerDialogTarget,value:ExplorerDialogSubmission){
  const {name,destinationId,confirmShare,manifest,operationId}=value;const item=target.item;
  if(target.action==="move"||target.action==="delete"){
   if(!manifest)throw new Error("unconfirmed");
   const done=await batches.start(target.action,target.items,manifest,destinationId,confirmShare,operationId);
   if(!done)throw new Error(batches.getError()||"unconfirmed");return true;
  }
  if(target.action==="create")return single.command("create_folder",{folderId:data?.folderId,name});
  if(target.action==="rename"&&item?.kind==="folder")return single.command("rename_folder",{folderId:item.id,version:item.folder.version,name});
  if(target.action==="rename"&&item?.kind==="file")return single.command("rename_file",{fileId:item.id,version:item.file.version,name});
  if(item?.kind==="template"&&(target.action==="rename"||target.action==="copy")){
   const copy=target.action==="copy";
   await writeDocument({action:target.action,operationId,documentId:copy?operationId:item.id,expectedRevision:copy?undefined:item.document.revision,sourceId:copy?item.id:undefined,name,folderId:copy?destinationId:undefined,confirmShare});
   if(!await refresh())throw new Error("unconfirmed");return true;
  }
  if(target.action==="download"){
   setDownloading(true);setDownloadError("");
   try{const response=await fetch("/api/document-library/download",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({items:target.items}),signal:AbortSignal.timeout(90000)});
    if(!response.ok){const failure=await response.json();throw new Error(failure.error??"unconfirmed");}
    const content=await response.blob();if(!content.size)throw new Error("unconfirmed");
    const url=URL.createObjectURL(content);const link=document.createElement("a");link.href=url;link.download="PT5-documents.zip";link.click();setTimeout(()=>URL.revokeObjectURL(url),60000);return true;
   }catch(cause){const error=cause instanceof Error?cause.message:"unconfirmed";setDownloadError(error);throw cause;}finally{setDownloading(false);}
  }
  return false;
 }
 return {single,batches,submit,busy:single.busy||batches.busy||downloading,error:downloadError||batches.error};
}
