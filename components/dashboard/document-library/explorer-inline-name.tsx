"use client";
import {useLayoutEffect,useRef} from "react";
import {useTranslations} from "next-intl";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/form-controls";
import type {InlineNaming} from "./use-inline-naming";
/** 焦点留在名称输入处；输入法选词、双击和输入框右键不冒泡为文件操作。 */
export function ExplorerInlineName({editor}:{editor:InlineNaming}){
 const input=useRef<HTMLInputElement>(null);const composing=useRef(false);const t=useTranslations("Documents");const edit=editor.editing!;
 useLayoutEffect(()=>{const node=input.current;if(!node)return;node.focus();const name=edit.item.name;const extension=edit.item.kind==="file"?name.lastIndexOf("."):-1;node.setSelectionRange(0,extension>0?extension:name.length);node.scrollIntoView({block:"nearest"});},[edit.item.id,edit.item.kind,edit.item.name]);
 const known=["invalid","folderNameConflict","conflict","forbidden","busy","defaultFolder"];
 return <div onClick={event=>event.stopPropagation()} onDoubleClick={event=>event.stopPropagation()} onContextMenu={event=>event.stopPropagation()}>
  <Input ref={input} data-inline-name aria-label={t("explorer.inlineName")} aria-invalid={Boolean(edit.error)} aria-describedby={edit.error?`name-error-${edit.item.id}`:undefined} value={edit.name} maxLength={"document" in edit.item?120:200} disabled={editor.saving||edit.uncertain} onChange={event=>editor.change(event.target.value)} onCompositionStart={()=>{composing.current=true;}} onCompositionEnd={()=>{composing.current=false;}} onBlur={()=>{if(!composing.current)void editor.commit();}} onKeyDown={event=>{
   event.stopPropagation();if(event.nativeEvent.isComposing||composing.current||event.keyCode===229)return;
   if(event.key==="Enter"){event.preventDefault();void editor.commit();}else if(event.key==="Escape"){event.preventDefault();editor.cancel();}
  }}/>
  {edit.uncertain&&<Button size="compact" variant="outline" disabled={editor.saving} onClick={()=>void editor.retry()}>{t("explorer.retryName")}</Button>}
  {edit.error&&<p id={`name-error-${edit.item.id}`} role="alert" className="mt-1 text-sm text-status-danger">{t(`errors.${known.includes(edit.error)?edit.error:"unconfirmed"}`)}</p>}
 </div>;
}
