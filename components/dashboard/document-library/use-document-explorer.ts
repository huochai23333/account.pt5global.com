"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {ExplorerLibrary,DocumentSelection} from "@/lib/document-library/model";
import {documentQuery,parseDocumentSelection} from "@/lib/document-library/selection";
/** 数据请求以序号隔离；导航新增历史，操作刷新替换当前历史，返回键重新读取授权数据。 */
export function useDocumentExplorer(initial:ExplorerLibrary|null,initialSelection:DocumentSelection){
 const [data,setData]=useState(initial);const [selection,setSelection]=useState<DocumentSelection>({...initialSelection,page:initial?.page??initialSelection.page});
 const current=useRef<DocumentSelection>({...initialSelection,page:initial?.page??initialSelection.page});const [loading,setLoading]=useState(false);const [error,setError]=useState(initial?"":"forbidden");const sequence=useRef(0);
 const load=useCallback(async(next=current.current,navigate=false,history=true)=>{
  const number=++sequence.current;current.current=next;setSelection(next);setLoading(true);setError("");setData(null);
  try{
   const response=await fetch(`/api/document-library?${documentQuery(next)}`,{cache:"no-store",signal:AbortSignal.timeout(30000)});
   const result=await response.json();if(!response.ok||!result.scope)throw new Error(result.error??"unconfirmed");
   if(number!==sequence.current)return false;
   const confirmed={...next,page:result.page,scope:result.scope,folder:result.folderId??undefined};current.current=confirmed;setSelection(confirmed);setData(result);
   if(history)window.history[navigate?"pushState":"replaceState"](null,"",`${window.location.pathname}?${documentQuery(confirmed)}`);
   return true;
  }catch(cause){if(number===sequence.current)setError(cause instanceof Error?cause.message:"unconfirmed");return false;}
  finally{if(number===sequence.current)setLoading(false);}
 },[]);
 useEffect(()=>{const back=()=>void load(parseDocumentSelection(new URLSearchParams(window.location.search)),false,false);window.addEventListener("popstate",back);return()=>window.removeEventListener("popstate",back);},[load]);
 return {data,selection,loading,error,load,navigate:(next:DocumentSelection)=>load({...next,page:1},true),refresh:()=>load()};
}
