"use client";
import {useEffect,useRef} from "react";
/** 只接管保存快捷键，输入框的复制粘贴保留；回调放入 ref，避免每次输入重装事件。 */
export function useDocumentKeyboard(save:(copy:boolean)=>void,enabled:boolean){
 const current=useRef(save);useEffect(()=>{current.current=save;},[save]);
 useEffect(()=>{if(!enabled)return;const key=(event:KeyboardEvent)=>{if((event.ctrlKey||event.metaKey)&&!event.altKey&&event.key.toLowerCase()==="s"){event.preventDefault();current.current(event.shiftKey);}};window.addEventListener("keydown",key);return()=>window.removeEventListener("keydown",key);},[enabled]);
}
