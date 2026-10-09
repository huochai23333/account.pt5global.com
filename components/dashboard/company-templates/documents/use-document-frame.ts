"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { TemplateDocument } from "@/lib/company-templates/documents/model";
import { documentRestoreBudget } from "@/lib/company-templates/documents/restore-budget";
/** 父页只接受当前 iframe 的沙箱来源与随机标识；恢复验证完成后才允许编辑和保存。 */
export function useDocumentFrame(document: TemplateDocument, receive:(state:Record<string,unknown>)=>void, dirty:()=>void, readState:()=>Record<string,unknown>) {
  const frame=useRef<HTMLIFrameElement>(null);const [desktop,setDesktop]=useState(false);const [attempt,setAttempt]=useState(0);
  const [load,setLoad]=useState<{token:string;src:string;status:"loading"|"ready"|"failed"}|null>(null);
  const exporter=useRef<{id:string;resolve:(s:Record<string,unknown>)=>void;reject:()=>void;timer:ReturnType<typeof setTimeout>}|null>(null);
  useEffect(()=>{const media=window.matchMedia("(min-width: 768px)");const update=()=>setDesktop(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
  useEffect(()=>{
    if(!desktop)return;
    const token=crypto.randomUUID();setLoad({token,src:`/api/company-template-documents/${document.id}/content?loadToken=${token}`,status:"loading"});
    const fail=()=>setLoad(current=>current?.token===token?{...current,status:"failed"}:current);
    const timer=setTimeout(fail,documentRestoreBudget(readState()));
    const message=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.origin!=="null"||!event.data||event.data.token!==token)return;
      const value=event.data;
      if(value.type==="pt5.document.boot")frame.current?.contentWindow?.postMessage({type:"pt5.document.initialize",token,state:readState()},"*");
      if(value.type==="pt5.document.error"){fail();return;}
      if(value.type==="pt5.document.dirty")dirty();
      if(value.type==="pt5.document.ready"||value.type==="pt5.document.state"){
        if(!value.state||typeof value.state!=="object"||Array.isArray(value.state)){fail();return;}
        if(value.type==="pt5.document.ready"){clearTimeout(timer);setLoad(current=>current?.token===token?{...current,status:"ready"}:current);}
        receive(value.state);
        const exporting=exporter.current;
        if(exporting && exporting.id===value.requestId){clearTimeout(exporting.timer);exporting.resolve(value.state);exporter.current=null;}
      }
    };
    window.addEventListener("message",message);
    return()=>{clearTimeout(timer);window.removeEventListener("message",message);if(exporter.current){clearTimeout(exporter.current.timer);exporter.current.reject();exporter.current=null;}};
  },[desktop,document,attempt,receive,dirty,readState]);
  const exportNow=useCallback(()=>new Promise<Record<string,unknown>>((resolve,reject)=>{
    if(!frame.current?.contentWindow||load?.status!=="ready"){reject(new Error("document_failed"));return;}
    const id=crypto.randomUUID();exporter.current={id,resolve,reject:()=>reject(new Error("document_failed")),timer:setTimeout(()=>{exporter.current=null;reject(new Error("document_failed"));},5000)};
    frame.current.contentWindow.postMessage({type:"pt5.document.export",token:load.token,requestId:id},"*");
  }),[load]);
  return{frame,desktop,load,exportNow,retry:()=>setAttempt(v=>v+1)};
}
