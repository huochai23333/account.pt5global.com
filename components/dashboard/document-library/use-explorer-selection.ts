"use client";
import {useState,useEffect} from "react";
import type {ExplorerItem,ExplorerTarget} from "@/lib/document-library/model";
import {explorerTarget,itemManageable} from "./explorer-helpers";
/** 选择范围只针对当前显示页；剪切清单单独保存，可跨目录粘贴，但切换账号不会复用。 */
export function useExplorerSelection(items:ExplorerItem[],location:string,userId:string){
 const [ids,setIds]=useState<Set<string>>(new Set());const [anchor,setAnchor]=useState<string|null>(null);const [cut,setCutState]=useState<ExplorerTarget[]>([]);
 const [clipboardMode,setClipboardMode]=useState<"cut"|"copy">("cut");
 // 按当前账号保存复制/剪切意图，权限和版本在粘贴时重新核对。
 useEffect(()=>{const timer=setTimeout(()=>{try{const saved=JSON.parse(sessionStorage.getItem(`PT5.document.clipboard.${userId}`)??"null");if(Array.isArray(saved?.items)&&["cut","copy"].includes(saved.mode)){setCutState(saved.items);setClipboardMode(saved.mode);}}catch{/* 损坏的剪贴板不执行写入。 */}},0);return()=>clearTimeout(timer);},[userId]);
 function setClipboard(mode:"cut"|"copy",items:ExplorerTarget[]){setCutState(items);setClipboardMode(mode);sessionStorage.setItem(`PT5.document.clipboard.${userId}`,JSON.stringify({mode,items}));}
 function setCut(items:ExplorerTarget[]){setClipboard("cut",items);}
 // 只在实际切换位置时清空；首屏挂载不能在用户刚点击后异步抹掉选择。
 const [selectionLocation,setSelectionLocation]=useState(location);
 if(selectionLocation!==location){setSelectionLocation(location);setIds(new Set());setAnchor(null);}
 const selected=items.filter(i=>ids.has(i.id));
 function select(id:string,ctrl=false,shift=false){
  if(shift&&anchor){const first=items.findIndex(i=>i.id===anchor);const last=items.findIndex(i=>i.id===id);if(first>=0&&last>=0){setIds(new Set([...ids,...items.slice(Math.min(first,last),Math.max(first,last)+1).map(i=>i.id)]));return;}}
  if(ctrl){setIds(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;});}else setIds(new Set([id]));setAnchor(id);
 }
 function clear(){setIds(new Set());setAnchor(null);}
 function cutSelected(){if(selected.length&&selected.every(itemManageable))setCut(selected.map(explorerTarget).filter((i):i is ExplorerTarget=>i!==null));}
 return {ids,selected,select,clear,selectAll:()=>setIds(new Set(items.map(i=>i.id))),toggleAll:()=>setIds(ids.size===items.length?new Set():new Set(items.map(i=>i.id))),cut,setCut,setClipboard,clipboardMode,cutSelected};
}
