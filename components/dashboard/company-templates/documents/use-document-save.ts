"use client";
import {useCallback, useEffect, useRef, useState} from "react";
import {canonicalState, type DocumentMutation, type TemplateDocument} from "@/lib/company-templates/documents/model";
import {writeDocument, documentErrorKey} from "@/lib/company-templates/documents/client";
export type SaveStatus = "loading"|"unsaved"|"saving"|"saved"|"failed"|"conflict";
/** 自动保存和普通保存共用串行通道，均更新当前位置；普通保存即使内容未改也核对当前修订。 */
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
  const flush = useCallback(async (manual = false): Promise<boolean> => {
    if (!writable || conflict.current) return false;
    // 普通保存先等待在途请求，再用最新修订提交内容，避免与自动保存互相覆盖。
    while (running.current) await running.current;
    if (conflict.current) return false;
    if (timer.current) clearTimeout(timer.current);
    const work = async () => {
      let force = manual; setError("");
      try {
        while (alive.current && (pending.current || force || canonicalState(latest.current)!==confirmed.current)) {
          if (!pending.current) {
            pending.current={action:"save",documentId:document.id,operationId:crypto.randomUUID(),expectedRevision:revision.current,state:latest.current};
            force=false;
          }
          setStatus("saving"); const saved=await writeDocument(pending.current);
          revision.current=saved.receipt.revision; confirmed.current=canonicalState(pending.current.state); pending.current=null;
          if (saved.document) setLocation(saved.document.location);
          if (snapshotGeneration.current===generation.current && canonicalState(latest.current)===confirmed.current) {dirtyRef.current=false; setDirty(false);}
          if (!manual && paused.current) break;
        }
        if (alive.current) setStatus(dirtyRef.current?"unsaved":"saved");
        return !dirtyRef.current && !pending.current;
      } catch (cause) {
        const code=documentErrorKey(cause);
        if (code==="document_conflict") {conflict.current=true; pending.current=null; setStatus("conflict");}
        else {
          // 明确未写入的校验错误可调整后新提交；响应丢失必须保留原编号核对。
          if (["document_too_large","document_forbidden","document_invalid","document_missing"].includes(code)) pending.current=null;
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
  return {status,error,dirty,receive,markDirty,flush,revision,acceptRevision,acceptLocation,readState,pause,resume,location};
}
