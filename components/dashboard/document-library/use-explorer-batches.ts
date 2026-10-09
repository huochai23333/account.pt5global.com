"use client";
import {useEffect,useRef,useState} from "react";
import type {DocumentBatch,DocumentManifest,ExplorerTarget} from "@/lib/document-library/model";
/** 页面只向原批次续办，并独立读取存档状态；网络断开不能被解释成成功或触发新批次。 */
export function useExplorerBatches(userId:string,refresh:()=>Promise<boolean>){
 const [batch,setBatch]=useState<DocumentBatch|null>(null);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const running=useRef(false);const failure=useRef("");
 // 即使浏览器在接收回执前断开，刷新也能从原批次编号读取结果。
 useEffect(()=>{const id=sessionStorage.getItem(`PT5.document.batch.${userId}`);if(!id)return;const controller=new AbortController();void fetch(`/api/document-library/batch?id=${id}`,{cache:"no-store",signal:controller.signal}).then(async response=>{if(response.ok)setBatch(await response.json());}).catch(()=>{});return()=>controller.abort();},[userId]);
 async function run(id:string,request?:DocumentBatch["request"],digest?:string){
  if(running.current)return false;running.current=true;setBusy(true);setError("");failure.current="";
  try{
   sessionStorage.setItem(`PT5.document.batch.${userId}`,id);
   let start=request;
   for(let step=0;step<1000;step++){
    const response=await fetch("/api/document-library/batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,request:start,digest}),signal:AbortSignal.timeout(90000)});
    const result=await response.json();if(!response.ok)throw new Error(result.error??"unconfirmed");start=undefined;
    const read=await fetch(`/api/document-library/batch?id=${id}`,{cache:"no-store",signal:AbortSignal.timeout(30000)});
    const actual=await read.json();if(!read.ok||actual.id!==id||JSON.stringify(actual.results)!==JSON.stringify(result.results)||actual.status!==result.status)throw new Error("unconfirmed");
    setBatch(actual);
    if(actual.status!=="pending"){if(actual.status!=="succeeded"){setError("partial");failure.current="partial";}await refresh();return actual.status==="succeeded";}
    // 本轮有失败就停下来展示明细，不能因自动循环反复删除同一个失败对象。
    if(actual.results.some((item:{status:string})=>item.status==="failed")){setError("partial");failure.current="partial";await refresh();return false;}
   }
   throw new Error("unconfirmed");
  }catch(cause){failure.current=cause instanceof Error?cause.message:"unconfirmed";setError(failure.current);await refresh();return false;}
  finally{running.current=false;setBusy(false);}
 }
 async function start(action:"move"|"delete",items:ExplorerTarget[],manifest:DocumentManifest,destinationId?:string,confirmShare=false,id=crypto.randomUUID()){return run(id,{action,items,destinationId,confirmShare},manifest.digest);}
 async function release(id:string){
  if(running.current)return;setBusy(true);
  try{const response=await fetch("/api/document-library/batch",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,release:true})});if(!response.ok)throw new Error("unconfirmed");setBatch(null);sessionStorage.removeItem(`PT5.document.batch.${userId}`);await refresh();}catch{setError("unconfirmed");}finally{setBusy(false);}
 }
 return {batch,busy,error,getError:()=>failure.current,start,resume:(id:string)=>run(id),release};
}
