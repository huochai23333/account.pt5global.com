"use client";
import {useState,useCallback,type ReactNode} from "react";
import {ExplorerMenu} from "./explorer-menu";
import type {ExplorerAction} from "./explorer-toolbar";
/** 文件区空白处接管右键；输入文字时保留浏览器正常编辑菜单。 */
export function ExplorerBackgroundMenu({children,canCreate,canPaste,busy,action}:{children:ReactNode;canCreate:boolean;canPaste:boolean;busy:boolean;action:(name:ExplorerAction)=>void}){
 const [position,setPosition]=useState<{x:number;y:number}|null>(null);const close=useCallback(()=>setPosition(null),[]);
 return <div className="h-full min-w-0" tabIndex={0} onContextMenu={event=>{
  if((event.target as HTMLElement).closest('input:not([type="checkbox"]),textarea,[contenteditable="true"]'))return;
  event.preventDefault();event.stopPropagation();if(!busy)setPosition({x:Math.max(8,Math.min(event.clientX,window.innerWidth-224)),y:Math.max(8,Math.min(event.clientY,window.innerHeight-340))});
 }} onKeyDown={event=>{if(event.target!==event.currentTarget)return;if(event.key==="ContextMenu"||(event.shiftKey&&event.key==="F10")){event.preventDefault();const box=event.currentTarget.getBoundingClientRect();setPosition({x:Math.min(box.left,window.innerWidth-224),y:Math.max(8,Math.min(box.top,window.innerHeight-340))});}}}>
  {children}{position&&<ExplorerMenu count={0} manageable={false} canCreate={canCreate} canNewDocument={canCreate} canPaste={canPaste} position={position} close={close} action={action}/>}
 </div>;
}
