"use client";
import {useRef,useState} from "react";
import {writeDraft} from "@/lib/company-templates/documents/draft-client";
import {documentErrorKey} from "@/lib/company-templates/documents/client";
import type {DraftMutation,TemplateDraft} from "@/lib/company-templates/documents/draft-model";
import type {FolderSaveChoice} from "./document-folder-dialog";
import type {useDraftSave} from "./use-draft-save";
/** 暂停自动保存后等待原请求，转正重试复用完整意图；取消先核对已提交结果，不能撤销已完成保存。 */
export function useDraftPromotion(draft:TemplateDraft,save:ReturnType<typeof useDraftSave>,exportNow:()=>Promise<Record<string,unknown>>,done:(id:string)=>void){
 const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [recovering,setRecovering]=useState(false);const running=useRef(false);const intent=useRef<DraftMutation|null>(null);
 function show(){if(running.current)return;save.pause();setError("");setOpen(true);}
 async function close(){if(running.current)return;if(intent.current){running.current=true;setBusy(true);try{const response=await fetch(`/api/company-template-document-drafts/${draft.id}`,{cache:"no-store"});if(!response.ok)throw new Error("document_not_confirmed");const actual=await response.json();if(actual.document){setOpen(false);done(actual.document.id);return;}if(!actual.draft)throw new Error("document_not_confirmed");intent.current=null;}catch{setError("document_not_confirmed");return;}finally{running.current=false;setBusy(false);}}setOpen(false);setRecovering(false);save.resume();}
 async function submit(choice:FolderSaveChoice){if(running.current)return;running.current=true;setBusy(true);setError("");try{
  // 先采集停止输入的最新快照，再等待原保存通道；最后再次采集，避免延迟消息使最新填写内容漏存。
  if(!intent.current){await exportNow();if(!await save.flush())throw new Error(save.failure()||"document_failed");const state=await exportNow();intent.current={action:"promote",draftId:draft.id,operationId:crypto.randomUUID(),expectedRevision:save.revision.current,folderId:choice.folderId,name:choice.name??draft.name,state};}
  const actual=await writeDraft(intent.current);if(!actual.document)throw new Error("document_not_confirmed");intent.current=null;setOpen(false);done(actual.document.id);
 }catch(cause){const key=documentErrorKey(cause);setError(key);if(["document_name_conflict","document_invalid","document_forbidden","document_conflict","document_too_large"].includes(key))intent.current=null;setRecovering(Boolean(intent.current));}finally{running.current=false;setBusy(false);}}
 return{open,busy,error,recovering,show,close:()=>void close(),submit};
}
