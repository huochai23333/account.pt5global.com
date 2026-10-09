"use client";
import {useEffect,useRef} from "react";
import {InteractiveButton} from "@/components/ui/button";
import {useTranslations} from "next-intl";
import type {ExplorerItem} from "@/lib/document-library/model";
import type {ExplorerAction} from "./explorer-toolbar";
/** 右键和更多按钮共用操作菜单，鼠标之外也可用键盘和触控打开。 */
export function ExplorerMenu({item,count,manageable,position,action,close}:{item:ExplorerItem;count:number;manageable:boolean;position:{x:number;y:number};action:(a:ExplorerAction)=>void;close:()=>void}){
 const t=useTranslations("Documents");const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{ref.current?.querySelector<HTMLButtonElement>("button")?.focus();const outside=(event:PointerEvent)=>{if(!ref.current?.contains(event.target as Node))close();};document.addEventListener("pointerdown",outside);return()=>document.removeEventListener("pointerdown",outside);},[close]);
 const actions:ExplorerAction[]=[...(count===1?["open" as const]:[]),...((item.kind==="folder"||item.kind==="file"||item.kind==="template")?["download" as const]:[]),...(manageable?["cut" as const,"move" as const,...(count===1?["rename" as const,...(item.kind==="template"?["copy" as const]:[])]:[]),"delete" as const]:[])];
 return <div ref={ref} role="menu" aria-label={t("explorer.more")} className="fixed z-50 max-h-[70vh] w-52 overflow-y-auto rounded-xl border border-border-subtle bg-popover p-1 shadow-lg" style={{left:position.x,top:position.y}} onKeyDown={event=>{
 if(event.key==="Escape"){event.preventDefault();close();}
 if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();const buttons=Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button")??[]);const index=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(index+(event.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length]?.focus();}
 }}>{actions.map(a=><InteractiveButton key={a} role="menuitem" type="button" className="block min-h-11 w-full rounded-lg px-3 text-start text-sm hover:bg-surface-interactive" onClick={()=>{action(a);close();}}>{t(a==="download"?"download":`explorer.${a}`)}</InteractiveButton>)}</div>;
}
