"use client";
import type {ReactNode,DragEventHandler} from "react";
import {useTranslations} from "next-intl";
import {LoaderCircle} from "lucide-react";
import {Button} from "@/components/ui/button";
/** 文件区独立呈现加载和失败；保留外部目录树，失败时不把旧文件当成新位置的内容。 */
export function ExplorerContent({loading,error,dragging,refresh,onDragOver,onDragLeave,onDrop,children}:{loading:boolean;error:string;dragging:boolean;refresh:()=>void;onDragOver:DragEventHandler<HTMLDivElement>;onDragLeave:DragEventHandler<HTMLDivElement>;onDrop:DragEventHandler<HTMLDivElement>;children:ReactNode}){
 const t=useTranslations("Documents");const known=["forbidden","invalid","busy","conflict"];
 // 窄屏允许工具栏向下展开，但为文件区保留独立高度；桌面则填满窗口剩余空间。
 return <div data-document-content aria-busy={loading} className={`h-96 min-h-0 min-w-0 flex-none overflow-y-auto overscroll-contain rounded-lg lg:h-auto lg:flex-1 ${dragging?"outline-2 outline-dashed outline-primary":""}`} onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
  {loading?<div role="status" className="flex h-full min-h-64 flex-col items-center justify-center gap-3 text-content-muted"><LoaderCircle aria-hidden className="size-7 motion-safe:animate-spin"/><p>{t("loading")}</p></div>:error?<div role="alert" className="flex h-full min-h-64 flex-col items-center justify-center gap-3 p-4 text-center"><p>{t(`errors.${known.includes(error)?error:"unconfirmed"}`)}</p><Button variant="outline" onClick={refresh}>{t("explorer.retryLoad")}</Button></div>:<>
   {dragging&&<p className="p-3 text-primary">{t("explorer.dropUpload")}<span className="block text-sm">{t("limits")}</span></p>}{children}
  </>}
 </div>;
}
