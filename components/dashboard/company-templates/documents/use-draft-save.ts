"use client";
import {useCallback, useEffect, useRef, useState} from "react";
import {canonicalState} from "@/lib/company-templates/documents/model";
import {documentErrorKey} from "@/lib/company-templates/documents/client";
import {writeDraft} from "@/lib/company-templates/documents/draft-client";
import type {DraftMutation,TemplateDraft} from "@/lib/company-templates/documents/draft-model";
type SaveStatus = "loading"|"unsaved"|"saving"|"saved"|"failed"|"conflict";
/** 云端草稿串行自动保存，只提交填写内容；转正由独立控制器在暂停保存后执行。 */
export function useDraftSave(document: TemplateDraft) {
  const latest = useRef(document.state); const confirmed = useRef(canonicalState(document.state));
  const revision = useRef(document.revision); const pending = useRef<DraftMutation|null>(null);
  const running = useRef<Promise<boolean>|null>(null); const conflict = useRef(false); const paused = useRef(false);
  // 转正控制器需要同步读取失败原因；React 文案状态可能还没完成下一次渲染。
  const failure = useRef("");
  const retrying = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null); const alive = useRef(true);
  const dirtyRef = useRef(false); const generation = useRef(0); const snapshotGeneration = useRef(0);
  const [status, setStatus] = useState<SaveStatus>("loading"); const [error, setError] = useState("");
  const [dirty, setDirty] = useState(false);
  const writable = true;
  const markDirty = useCallback(() => {
    if (!writable) return;
    generation.current++; dirtyRef.current=true; setDirty(true);
    if (!running.current && !conflict.current) setStatus("unsaved");
  }, [writable]);
  const flush = useCallback(async (): Promise<boolean> => {
    if (!writable || conflict.current) return false;
    // 等待在途请求后再采集当前修订，避免同一窗口自身产生旧版本冲突。
    while (running.current) await running.current;
    if (conflict.current) return false;
    if (timer.current) clearTimeout(timer.current);
    const work = async () => {
      setError("");failure.current="";
      try {
        while (alive.current && (pending.current || canonicalState(latest.current)!==confirmed.current)) {
          if (!pending.current) {
            pending.current={action:"save",draftId:document.id,operationId:crypto.randomUUID(),expectedRevision:revision.current,state:latest.current};
          }
          setStatus("saving"); const saved=await writeDraft(pending.current);
          revision.current=saved.receipt.revision; confirmed.current=canonicalState(pending.current.state); pending.current=null;
          if (snapshotGeneration.current===generation.current && canonicalState(latest.current)===confirmed.current) {dirtyRef.current=false; setDirty(false);}
          if (paused.current) break;
        }
        if (alive.current) setStatus(dirtyRef.current?"unsaved":"saved");
        return !dirtyRef.current && !pending.current;
      } catch (cause) {
        const code=documentErrorKey(cause);
        failure.current=code;
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
  const readState = useCallback(()=>latest.current, []);
  /** 人工重试先采集窗口内容，再走原保存通道；在途操作编号保留，连续点击不会另开请求。 */
  const retrySave = useCallback(async(exportState:()=>Promise<Record<string,unknown>>) => {
    if(retrying.current||conflict.current)return;retrying.current=true;setStatus("saving");
    try{await exportState();await flush();}catch(cause){const code=documentErrorKey(cause);failure.current=code;setError(code);setStatus("failed");}finally{retrying.current=false;}
  },[flush]);
  useEffect(() => {
    alive.current=true;
    const online=()=>{if (!paused.current) void flush();};
    const leave=(event: BeforeUnloadEvent)=>{if(dirtyRef.current||pending.current){event.preventDefault();event.returnValue="";}};
    window.addEventListener("online",online); window.addEventListener("beforeunload",leave);
    return ()=>{alive.current=false; if(timer.current)clearTimeout(timer.current); window.removeEventListener("online",online); window.removeEventListener("beforeunload",leave);};
  }, [flush]);
  return {status,error,dirty,receive,markDirty,flush,revision,acceptRevision,readState,pause,resume,retrySave,failure:()=>failure.current};
}
