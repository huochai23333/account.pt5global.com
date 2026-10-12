"use client";
import {useEffect,useLayoutEffect,useRef,useState} from "react";
import {InteractiveButton} from "@/components/ui/button";
import {useTranslations} from "next-intl";
import type {ExplorerItem} from "@/lib/document-library/model";
import type {ExplorerAction} from "./explorer-toolbar";
/** 右键和更多按钮共用操作菜单，鼠标之外也可用键盘和触控打开。 */
export function ExplorerMenu({item,count,manageable,position,action,close,canCreate=false,canPaste=false,canNewDocument=false,folderContext=false}:{item?:ExplorerItem;count:number;manageable:boolean;position:{x:number;y:number};action:(a:ExplorerAction)=>void;close:()=>void;canCreate?:boolean;canPaste?:boolean;canNewDocument?:boolean;folderContext?:boolean}){
 const t=useTranslations("Documents");const templates=useTranslations("CompanyTemplates.documents");const ref=useRef<HTMLDivElement>(null);const [coordinates,setCoordinates]=useState(position);
 useEffect(()=>{ref.current?.querySelector<HTMLButtonElement>("button")?.focus();const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))close();};document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside);},[close]);
 // 空白处和目录树也使用应用菜单；默认根目录可新建和粘贴，但保留根目录本身。
 const actions:ExplorerAction[]=[...(canCreate?["create" as const]:[]),...(canNewDocument?["newDocument" as const]:[]),...(canPaste?["paste" as const]:[]),...(!item||folderContext?["refresh" as const]:[]),...(count===1?["open" as const]:[]),...((item?.kind==="folder"||item?.kind==="file"||item?.kind==="template")?["download" as const]:[]),...(manageable?["cut" as const,"copy" as const,"move" as const,...(count===1?["rename" as const,...(item?.kind==="template"?["duplicate" as const]:[])]:[]),"delete" as const]:[])];
 // 目录菜单比文件菜单长，必须按真实高度定位，避免底部删除等操作落在窗口外。
 useLayoutEffect(()=>{const box=ref.current?.getBoundingClientRect();if(box)setCoordinates({x:Math.max(8,Math.min(position.x,window.innerWidth-box.width-8)),y:Math.max(8,Math.min(position.y,window.innerHeight-box.height-8))});},[position.x,position.y,actions.length]);
 return <div ref={ref} role="menu" aria-label={t("explorer.more")} className="fixed z-50 max-h-[70vh] w-52 overflow-y-auto rounded-xl border border-border-subtle bg-popover p-1 shadow-lg" style={{left:coordinates.x,top:coordinates.y}} onKeyDown={event=>{
 if(event.key==="Escape"){event.preventDefault();close();}
 if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();const buttons=Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button")??[]);const index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(index+(event.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length]?.focus();}
 }}>{actions.map(a=><InteractiveButton key={a} role="menuitem" type="button" className="block min-h-11 w-full rounded-lg px-3 text-start text-sm hover:bg-surface-interactive" onClick={()=>{action(a);close();}}>{a==="newDocument"?templates("create"):t(a==="download"?"download":`explorer.${a}`)}</InteractiveButton>)}</div>;
}
