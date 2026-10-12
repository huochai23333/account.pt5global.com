"use client";
import {useCallback,useEffect,useRef,useState} from "react";
import type {DocumentArchive,DocumentFolder,ExplorerItem} from "@/lib/document-library/model";
/** 目录和文件区分开加载，切换目录只更新右侧；中止旧请求，防止晚到的结果覆盖新位置。 */
export function useSaveAsBrowser(initialFolderId?:string){
 const [data,setData]=useState<{archives:DocumentArchive[];folders:DocumentFolder[];userId:string}>({archives:[],folders:[],userId:""});const [history,setHistory]=useState<string[]>([]);const [index,setIndex]=useState(0);
 const [query,setQuery]=useState("");const [page,setPage]=useState(1);const [items,setItems]=useState<ExplorerItem[]>([]);const [total,setTotal]=useState(0);const [loading,setLoading]=useState(true);const [error,setError]=useState("");const [reload,setReload]=useState(0);
 const [directoryError,setDirectoryError]=useState(false);const initialized=useRef(false);const folderId=history[index]??"";const folder=data.folders.find(f=>f.id===folderId);const [selected,setSelected]=useState("");
 const loadDirectories=useCallback(async(signal?:AbortSignal)=>{
  setDirectoryError(false);try{const response=await fetch("/api/company-template-documents/destinations",{cache:"no-store",signal});const result=await response.json();if(!response.ok||!Array.isArray(result.folders))throw new Error("document_failed");if(signal?.aborted)return;setData(result);
   if(!initialized.current){const first=result.folders.find((f:DocumentFolder)=>f.id===initialFolderId)??result.folders.find((f:DocumentFolder)=>f.system_key&&result.archives.some((a:DocumentArchive)=>a.id===f.archive_id&&a.user_id===result.userId));initialized.current=true;if(first)setHistory([first.id]);else setLoading(false);}
  }catch{if(!signal?.aborted){setDirectoryError(true);setLoading(false);}}
 },[initialFolderId]);
 useEffect(()=>{const controller=new AbortController();void loadDirectories(controller.signal);return()=>controller.abort();},[loadDirectories]);
 useEffect(()=>{if(!folderId)return;const controller=new AbortController();setLoading(true);setError("");const timer=setTimeout(()=>{
  const params=new URLSearchParams({folder:folderId,query,page:String(page)});void fetch(`/api/company-template-documents/save-as?${params}`,{cache:"no-store",signal:controller.signal}).then(async response=>{const value=await response.json();if(!response.ok)throw new Error(value.error??"document_failed");if(!controller.signal.aborted){setItems(value.items);setTotal(value.total);}}).catch(cause=>{if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:"document_failed");}).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
 },query?300:0);return()=>{clearTimeout(timer);controller.abort();};},[folderId,query,page,reload]);
 function navigate(id:string){if(id===folderId)return;setHistory([...history.slice(0,index+1),id]);setIndex(index+1);setQuery("");setPage(1);setSelected("");}
 function traverse(next:number){setIndex(next);setQuery("");setPage(1);setSelected("");}
 return{data,folder,folderId,items,total,loading,error,directoryError,selected,setSelected,query,setQuery:(value:string)=>{setQuery(value);setPage(1);setSelected("");},page,setPage:(value:number)=>{setPage(value);setSelected("");},navigate,back:()=>traverse(index-1),forward:()=>traverse(index+1),canBack:index>0,canForward:index<history.length-1,up:()=>{if(folder?.parent_id)navigate(folder.parent_id);},refresh:()=>setReload(v=>v+1),loadDirectories};
}
export type SaveAsBrowser=ReturnType<typeof useSaveAsBrowser>;
