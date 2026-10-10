"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {ExplorerLibrary,DocumentSelection} from "@/lib/document-library/model";
import {documentQuery,parseDocumentSelection} from "@/lib/document-library/selection";
/** 数据请求以序号隔离；导航新增历史，操作刷新替换当前历史，返回键重新读取授权数据。 */
export function useDocumentExplorer(initial:ExplorerLibrary|null,initialSelection:DocumentSelection){
 const [data,setData]=useState(initial);const [selection,setSelection]=useState<DocumentSelection>({...initialSelection,page:initial?.page??initialSelection.page});
 const current=useRef<DocumentSelection>({...initialSelection,page:initial?.page??initialSelection.page});const [loading,setLoading]=useState(false);const [error,setError]=useState(initial?"":"forbidden");const sequence=useRef(0);const request=useRef<AbortController|null>(null);
 const load=useCallback(async(next=current.current,navigate=false,history=true)=>{
  // 查询期间保留已授权的目录和工具栏；右侧文件区单独显示加载，旧请求不能覆盖新位置。
  const number=++sequence.current;request.current?.abort();const controller=new AbortController();request.current=controller;current.current=next;setSelection(next);setLoading(true);setError("");
  try{
   const response=await fetch(`/api/document-library?${documentQuery(next)}`,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(30000)])});
   // 权限已经撤回时清除缓存，不能继续展示此前可见的目录名称。
   if(number===sequence.current&&(response.status===401||response.status===403))setData(null);
   const result=await response.json();if(!response.ok||!result.scope)throw new Error(result.error??"unconfirmed");
   if(number!==sequence.current)return false;
   const confirmed={...next,page:result.page,scope:result.scope,folder:result.folderId??undefined};current.current=confirmed;setSelection(confirmed);setData(result);
   if(history)window.history[navigate?"pushState":"replaceState"](null,"",`${window.location.pathname}?${documentQuery(confirmed)}`);
   return true;
  }catch(cause){if(number===sequence.current)setError(cause instanceof Error?cause.message:"unconfirmed");return false;}
  finally{if(number===sequence.current)setLoading(false);}
 },[]);
 useEffect(()=>{const back=()=>void load(parseDocumentSelection(new URLSearchParams(window.location.search)),false,false);window.addEventListener("popstate",back);return()=>{window.removeEventListener("popstate",back);request.current?.abort();};},[load]);
 return {data,selection,loading,error,load,navigate:(next:DocumentSelection)=>load({...next,page:1},true),refresh:()=>load()};
}
