"use client";
import {useRef, useState} from "react";
import type {FolderSaveChoice} from "./document-folder-dialog";
import type {useDocumentSave} from "./use-document-save";
/** 弹窗生命周期与内容采集独立于编辑页；关闭前提交状态不能被重复点击改变。 */
export function useDocumentFolderSave(save: ReturnType<typeof useDocumentSave>, exportNow: () => Promise<Record<string,unknown>>) {
  const [open,setOpen]=useState(false); const [busy,setBusy]=useState(false); const [failed,setFailed]=useState(false);
  const running=useRef(false);
  function show() {save.pause(); setFailed(false); setOpen(true);}
  function close() {if(running.current)return; save.cancelFolderSubmission();setOpen(false);save.resume();}
  async function submit(choice: FolderSaveChoice) {
    if(running.current)return; running.current=true; setBusy(true); setFailed(false);
    try {await exportNow(); if(await save.flush(choice)){setOpen(false);save.resume();}}
    catch {setFailed(true);}
    finally {running.current=false; setBusy(false);}
  }
  return {open,busy,show,close,submit,failed};
}
