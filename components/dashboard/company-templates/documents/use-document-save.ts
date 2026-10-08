"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { canonicalState, type DocumentMutation, type TemplateDocument } from "@/lib/company-templates/documents/model";
import { writeDocument, documentErrorKey } from "@/lib/company-templates/documents/client";
export type SaveStatus = "loading"|"unsaved"|"saving"|"saved"|"failed"|"conflict";
/** 只允许一个保存请求在途；失败保留操作编号，恢复网络后先确认原请求再写最新内容。 */
export function useDocumentSave(document: TemplateDocument) {
  const latest = useRef(document.state); const confirmed=useRef(canonicalState(document.state));
  const revision=useRef(document.revision); const pending=useRef<DocumentMutation|null>(null);
  const running=useRef(false); const conflict=useRef(false); const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [status,setStatus]=useState<SaveStatus>("loading"); const [error,setError]=useState(""); const [dirty,setDirty]=useState(false);
  const alive=useRef(true); const dirtyRef=useRef(false); const generation=useRef(0); const snapshotGeneration=useRef(0);
  const markDirty=useCallback(()=>{generation.current++;dirtyRef.current=true;setDirty(true);if(!running.current&&!conflict.current)setStatus("unsaved");},[]);
  const flush=useCallback(async()=>{
    if(running.current||conflict.current)return false;
    if(timer.current)clearTimeout(timer.current);
    running.current=true;setError("");
    try {
      while(alive.current && (pending.current || canonicalState(latest.current)!==confirmed.current)) {
        pending.current ??= {action:"save",documentId:document.id,operationId:crypto.randomUUID(),expectedRevision:revision.current,state:latest.current};
        setStatus("saving");const saved=await writeDocument(pending.current);
        revision.current=saved.receipt.revision;confirmed.current=canonicalState(pending.current.state);pending.current=null;
        // 新编辑的快照尚未到达时，不提前把“正在保存”变成“已保存”。
        // 请求期间也可能收到新的快照；只有最后一次变更已导出且内容一致，才能解除离开提醒。
        if(snapshotGeneration.current===generation.current && canonicalState(latest.current)===confirmed.current){dirtyRef.current=false;setDirty(false);}
      }
      if(alive.current)setStatus(dirtyRef.current?"unsaved":"saved");
      return !dirtyRef.current && !pending.current;
    }catch(cause){
      const code=documentErrorKey(cause);
      if(code==="document_conflict"){conflict.current=true;pending.current=null;setStatus("conflict");}
      else {
        // 超限校验没有提交写入；减小图片后允许创建新请求。网络失败仍保留原操作编号以免重复写入。
        if(code==="document_too_large")pending.current=null;
        setStatus("failed");
      }
      setError(code);return false;
    }
    finally{running.current=false;}
  },[document.id]);
  const receive=useCallback((state:Record<string,unknown>)=>{
    latest.current=state;snapshotGeneration.current=generation.current;
    if(canonicalState(state)===confirmed.current && !pending.current){dirtyRef.current=false;setDirty(false);if(!running.current&&!conflict.current){setStatus("saved");setError("");}return;}
    dirtyRef.current=true;setDirty(true);if(!running.current&&!conflict.current)setStatus("unsaved");
    if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(()=>void flush(),1000);
  },[flush]);
  const acceptRevision=useCallback((value:number)=>{revision.current=value;},[]);
  const readState=useCallback(()=>latest.current,[]);
  useEffect(()=>{
    alive.current=true;
    const online=()=>void flush();
    const leave=(event:BeforeUnloadEvent)=>{if(dirtyRef.current||pending.current){event.preventDefault();event.returnValue="";}};
    window.addEventListener("online",online);window.addEventListener("beforeunload",leave);
    return()=>{alive.current=false;if(timer.current)clearTimeout(timer.current);window.removeEventListener("online",online);window.removeEventListener("beforeunload",leave);};
  },[flush]);
  return{status,error,dirty,receive,markDirty,flush,latest,revision,acceptRevision,readState};
}
