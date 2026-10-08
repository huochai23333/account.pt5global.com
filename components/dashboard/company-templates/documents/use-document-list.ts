"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {TemplateDocumentSummary} from "@/lib/company-templates/documents/model";
/** 搜索切换会废弃旧请求，避免慢响应覆盖新的列表；摘要分页不读取图片。 */
export function useDocumentList(initial:TemplateDocumentSummary[]){
  const [documents,setDocuments]=useState(initial);const [search,setSearch]=useState("");const [busy,setBusy]=useState(false);const [error,setError]=useState(false);const [more,setMore]=useState(initial.length===50);
  const generation=useRef(0);
  const invalidate=useCallback(()=>{generation.current++;},[]);
  useEffect(()=>{if(!search){invalidate();setDocuments(initial);setMore(initial.length===50);setError(false);setBusy(false);return;}invalidate();setBusy(true);setError(false);const timer=setTimeout(()=>void load(search,0),300);return()=>{clearTimeout(timer);invalidate();};},[search,initial,invalidate]);
  async function load(query:string,offset:number){
    const current=++generation.current;setBusy(true);setError(false);
    try{const response=await fetch(`/api/company-template-documents?search=${encodeURIComponent(query)}&offset=${offset}`,{signal:AbortSignal.timeout(30000)});const result=await response.json();if(!response.ok||result.ok!==true)throw Error();if(current===generation.current){setDocuments(previous=>offset?[...previous,...result.documents]:result.documents);setMore(result.documents.length===50);}}
    catch{if(current===generation.current)setError(true);}finally{if(current===generation.current)setBusy(false);}
  }
  return{documents,search,setSearch,busy,error,more,loadMore:()=>load(search,documents.length),reload:()=>load(search,0)};
}
