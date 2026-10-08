"use client";
import { useRef,useState } from "react";
import { writeDocument,documentErrorKey } from "@/lib/company-templates/documents/client";
import type { DocumentMutation, TemplateDocument, TemplateDocumentSummary } from "@/lib/company-templates/documents/model";
export type DocumentAction="rename"|"copy"|"delete";
/** 弹窗请求独立于页面组装；复制可以读取冲突窗口里的未保存内容。 */
export function useDocumentActions(document:TemplateDocumentSummary,getRevision:()=>number,getState?:()=>Promise<Record<string,unknown>>,beforeRename?:()=>Promise<boolean>,onChanged?:(document:TemplateDocument|null)=>void){
  const [action,setAction]=useState<DocumentAction|null>(null);const [name,setName]=useState(document.name);
  const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const intent=useRef<DocumentMutation|null>(null);const running=useRef(false);
  function open(next:DocumentAction){intent.current=null;setError("");setName(next==="copy"?document.name.slice(0,115)+" (2)":document.name);setAction(next);}
  async function submit(){
    if(!action||running.current)return null;running.current=true;setBusy(true);setError("");
    try{
      if(!intent.current){
        if(action==="rename" && beforeRename && !(await beforeRename()))throw new Error("document_failed");
        const state=action==="copy"&&getState?await getState():undefined;
        intent.current={action,operationId:crypto.randomUUID(),documentId:action==="copy"?crypto.randomUUID():document.id,
          ...(action==="copy"?{sourceId:document.id}:{expectedRevision:getRevision()}),...(action!=="delete"?{name}:{}),...(state?{state}:{})};
      }
      const result=await writeDocument(intent.current);onChanged?.(result.document);setAction(null);return result;
    }catch(cause){setError(documentErrorKey(cause));return null;}finally{running.current=false;setBusy(false);}
  }
  return{action,name,setName,busy,error,open,close:()=>{if(!running.current)setAction(null);},submit};
}
