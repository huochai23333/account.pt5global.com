"use client";
import {useRef,useState} from "react";
import {DocumentSaveAsDialog} from "@/components/dashboard/company-templates/documents/document-save-as-dialog";
import type {FolderSaveChoice} from "@/components/dashboard/company-templates/documents/document-folder-dialog";
import {writeDocument,documentErrorKey} from "@/lib/company-templates/documents/client";
import type {DocumentMutation} from "@/lib/company-templates/documents/model";
import type {ExplorerItem} from "@/lib/document-library/model";
/** 单份模板的另存为复用同一窗口和原凭证；多项复制仍由批量模块维护逐项结果。 */
export function ExplorerTemplateSaveAs({item,close,refresh}:{item:Extract<ExplorerItem,{kind:"template"}>;close:()=>void;refresh:()=>Promise<boolean>}){
 const [recovering,setRecovering]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const running=useRef(false);const intent=useRef<DocumentMutation|null>(null);
 async function submit(choice:FolderSaveChoice){if(running.current)return;running.current=true;setBusy(true);setError("");try{intent.current??={action:"copy",documentId:crypto.randomUUID(),operationId:crypto.randomUUID(),sourceId:item.id,expectedRevision:item.document.revision,folderId:choice.folderId,name:choice.name};await writeDocument(intent.current);if(!await refresh())throw new Error("document_not_confirmed");close();}catch(cause){const key=documentErrorKey(cause);setError(key);if(["document_name_conflict","document_forbidden","document_invalid","document_conflict"].includes(key))intent.current=null;setRecovering(Boolean(intent.current));}finally{running.current=false;setBusy(false);}}
 return <DocumentSaveAsDialog currentFolderId={item.document.folder_id} initialName={item.name.slice(0,115)+" (2)"} busy={busy} recovering={recovering} error={error} close={()=>{if(!running.current)close();}} submit={submit}/>;
}
