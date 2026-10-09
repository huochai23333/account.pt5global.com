"use client";
import {useCallback, useEffect, useRef, useState} from "react";
import {canonicalState, type DocumentMutation, type TemplateDocument} from "@/lib/company-templates/documents/model";
import {writeDocument, documentErrorKey} from "@/lib/company-templates/documents/client";
import type {FolderSaveChoice} from "./document-folder-dialog";
export type SaveStatus = "loading"|"unsaved"|"saving"|"saved"|"failed"|"conflict";
/** 自动保存和手动归档共用一条串行通道，内容和位置由同一事务更新。 */
export function useDocumentSave(document: TemplateDocument) {
  const latest = useRef(document.state); const confirmed = useRef(canonicalState(document.state));
  const revision = useRef(document.revision); const pending = useRef<DocumentMutation|null>(null);
  const running = useRef<Promise<boolean>|null>(null); const conflict = useRef(false); const paused = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null); const alive = useRef(true);
  const dirtyRef = useRef(false); const generation = useRef(0); const snapshotGeneration = useRef(0);
  const [status, setStatus] = useState<SaveStatus>("loading"); const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false); const [location, setLocation] = useState(document.location);
  const writable = document.location.can_manage;
  const markDirty = useCallback(() => {
    if (!writable) return;
    generation.current++; dirtyRef.current=true; setDirty(true);
    if (!running.current && !conflict.current) setStatus("unsaved");
  }, [writable]);
  const flush = useCallback(async (choice?: FolderSaveChoice): Promise<boolean> => {
    if (!writable || conflict.current) return false;
    // 弹窗确认先等待在途请求，再使用最新修订提交位置，避免与自动保存互相覆盖。
    while (running.current) await running.current;
    if (conflict.current) return false;
    if (timer.current) clearTimeout(timer.current);
    const work = async () => {
      let force = Boolean(choice); setError("");
      try {
        while (alive.current && (pending.current || force || canonicalState(latest.current)!==confirmed.current)) {
          if (!pending.current) {
            pending.current={action:"save",documentId:document.id,operationId:crypto.randomUUID(),expectedRevision:revision.current,state:latest.current,
              ...(choice?{folderId:choice.folderId,confirmShare:choice.confirmShare}:{})};
            force=false;
          }
          setStatus("saving"); const saved=await writeDocument(pending.current);
          revision.current=saved.receipt.revision; confirmed.current=canonicalState(pending.current.state); pending.current=null;
          if (saved.document) setLocation(saved.document.location);
          if (snapshotGeneration.current===generation.current && canonicalState(latest.current)===confirmed.current) {dirtyRef.current=false; setDirty(false);}
          if (!choice && paused.current) break;
        }
        if (alive.current) setStatus(dirtyRef.current?"unsaved":"saved");
        return !dirtyRef.current && !pending.current;
      } catch (cause) {
        const code=documentErrorKey(cause);
        if (code==="document_conflict") {conflict.current=true; pending.current=null; setStatus("conflict");}
        else {
          // 明确未写入的校验错误可调整后新提交；响应丢失必须保留原编号核对。
          if (["document_too_large","document_forbidden","document_share_confirmation","document_invalid","document_missing"].includes(code)) pending.current=null;
          setStatus("failed");
        }
        setError(code); return false;
      }
    };
    const task=work(); running.current=task;
    try {return await task;} finally {if (running.current===task) running.current=null;}
  }, [document.id, writable]);
  const receive = useCallback((state: Record<string,unknown>) => {
    latest.current=state; snapshotGeneration.current=generation.current;
    if (!writable) {setStatus("saved"); return;}
    if (canonicalState(state)===confirmed.current && !pending.current) {dirtyRef.current=false; setDirty(false); if (!running.current && !conflict.current) {setStatus("saved"); setError("");} return;}
    dirtyRef.current=true; setDirty(true); if (!running.current && !conflict.current) setStatus("unsaved");
    if (timer.current) clearTimeout(timer.current);
    if (!paused.current) timer.current=setTimeout(()=>void flush(),1000);
  }, [flush,writable]);
  const pause = useCallback(() => {paused.current=true; if(timer.current) clearTimeout(timer.current);}, []);
  const cancelFolderSubmission = useCallback(() => {
    if (!pending.current?.folderId) return;
    // 取消未确认的归档后不再重送移动意图。新提交只保存内容，仍带原修订：
    // 如果之前的请求已经落库，则触发冲突要求重新打开，不能猜测结果或覆盖他人修改。
    pending.current={action:"save",documentId:document.id,operationId:crypto.randomUUID(),expectedRevision:revision.current,state:latest.current};
    dirtyRef.current=true;setDirty(true);setError("");setStatus("unsaved");
  }, [document.id]);
  const resume = useCallback(() => {paused.current=false; if (dirtyRef.current || pending.current) timer.current=setTimeout(()=>void flush(),1000);}, [flush]);
  const acceptRevision = useCallback((value: number) => {revision.current=value;}, []);
  const acceptLocation = useCallback((value: TemplateDocument["location"]) => {setLocation(value);}, []);
  const readState = useCallback(()=>latest.current, []);
  useEffect(() => {
    alive.current=true;
    const online=()=>{if (!paused.current) void flush();};
    const leave=(event: BeforeUnloadEvent)=>{if(dirtyRef.current||pending.current){event.preventDefault();event.returnValue="";}};
    window.addEventListener("online",online); window.addEventListener("beforeunload",leave);
    return ()=>{alive.current=false; if(timer.current)clearTimeout(timer.current); window.removeEventListener("online",online); window.removeEventListener("beforeunload",leave);};
  }, [flush]);
  return {status,error,dirty,receive,markDirty,flush,revision,acceptRevision,acceptLocation,readState,pause,resume,cancelFolderSubmission,location};
}
