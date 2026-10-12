"use client";
import {useEffect,useRef,useState} from "react";
import type {DraftSummary,DraftMutation} from "@/lib/company-templates/documents/draft-model";
import {writeDraft} from "@/lib/company-templates/documents/draft-client";
import {documentErrorKey} from "@/lib/company-templates/documents/client";
export type DraftListData={drafts:DraftSummary[];total:number;page:number};
/** 查询只取自己的摘要；删除失败重试原操作，重新读取列表后才确认条目消失。 */
export function useDraftList(initial:DraftListData){const [data,setData]=useState(initial);const [query,setQuery]=useState("");const [page,setPage]=useState(1);const [error,setError]=useState("");const [loading,setLoading]=useState(false);const [busy,setBusy]=useState(false);const [reload,setReload]=useState(0);const intent=useRef<DraftMutation|null>(null);const running=useRef(false);
 useEffect(()=>{const controller=new AbortController();setLoading(true);const timer=setTimeout(()=>{void fetch(`/api/company-template-document-drafts?search=${encodeURIComponent(query)}&page=${page}`,{cache:"no-store",signal:controller.signal}).then(async response=>{if(!response.ok)throw new Error("document_failed");const value=await response.json();if(!controller.signal.aborted){setData(value);setError("");}}).catch(()=>{if(!controller.signal.aborted)setError("document_failed");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});},query?300:0);return()=>{clearTimeout(timer);controller.abort();};},[query,page,reload]);
 async function remove(draft:DraftSummary){if(running.current)return;running.current=true;setBusy(true);setError("");if(intent.current?.draftId!==draft.id)intent.current={action:"delete",draftId:draft.id,operationId:crypto.randomUUID(),expectedRevision:draft.revision};try{await writeDraft(intent.current);const response=await fetch(`/api/company-template-document-drafts/${draft.id}`,{cache:"no-store"});if(!response.ok||(await response.json()).draft)throw new Error("document_not_confirmed");intent.current=null;setReload(v=>v+1);}catch(cause){const key=documentErrorKey(cause);setError(key);if(["document_conflict","document_forbidden","document_missing"].includes(key))intent.current=null;}finally{running.current=false;setBusy(false);}}
 return{data,query,setQuery:(q:string)=>{setQuery(q);setPage(1);},page,setPage,error,loading,busy,remove,refresh:()=>setReload(v=>v+1)};
}
