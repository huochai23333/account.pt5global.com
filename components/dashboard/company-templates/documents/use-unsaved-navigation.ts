"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useDashboardConfirm} from "@/components/dashboard/dashboard-confirm-provider";
/** 侧栏和普通链接都经过同一个提醒，避免只保护编辑器自己的返回按钮。 */
export function useUnsavedNavigation(dirty:boolean,message:string,title:string){
  const confirm=useDashboardConfirm();const router=useRouter();
  useEffect(()=>{
    if(!dirty)return;
    const click=(event:MouseEvent)=>{
      const target=event.target instanceof Element?event.target.closest("a[href]"):null;
      if(!(target instanceof HTMLAnchorElement)||target.target==="_blank"||event.ctrlKey||event.metaKey||event.shiftKey)return;
      const destination=new URL(target.href,window.location.href);
      if(destination.href===window.location.href||destination.origin!==window.location.origin)return;
      event.preventDefault();event.stopImmediatePropagation();
      void confirm({title,description:message,tone:"warning"}).then(accepted=>{if(accepted)router.push(destination.pathname+destination.search+destination.hash);});
    };
    // Chrome 的导航事件还能在同页历史返回前取消；浏览器整页离开由 beforeunload 保护。
    const navigation=(window as Window & {navigation?:EventTarget & {traverseTo?:(key:string)=>Promise<unknown>}}).navigation;
    let replay=false;
    const traverse=(event:Event)=>{
      if(replay){replay=false;return;}
      const target=event as Event & {navigationType?:string;destination?:{key:string}};
      if(target.navigationType!=="traverse"||!event.cancelable||!target.destination?.key||!navigation?.traverseTo)return;
      event.preventDefault();const key=target.destination.key;
      void confirm({title,description:message,tone:"warning"}).then(accepted=>{if(accepted){replay=true;void navigation.traverseTo!(key).catch(()=>{replay=false;});}});
    };
    document.addEventListener("click",click,true);navigation?.addEventListener("navigate",traverse);
    return()=>{document.removeEventListener("click",click,true);navigation?.removeEventListener("navigate",traverse);};
  },[dirty,message,title,confirm,router]);
}
