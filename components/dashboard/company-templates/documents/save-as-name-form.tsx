"use client";
import {useState} from "react";
import {useTranslations} from "next-intl";
import {Field,Input} from "@/components/ui/form-controls";
/** 文件名状态独立于目录查询，切换目录或窄屏时不丢失；提交前仍由服务端复核长度和同名。 */
export function useSaveAsName(initialName:string){return useState(initialName);}
export function SaveAsNameForm({name,setName,locked,onSubmit}:{name:string;setName:(name:string)=>void;locked:boolean;onSubmit:()=>void}){
 const t=useTranslations("CompanyTemplates.documents");const library=useTranslations("Documents");
 return <><Field label={t("fileName")}><Input autoFocus disabled={locked} maxLength={120} value={name} onChange={event=>setName(event.target.value)} onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();onSubmit();}}}/></Field><p className="text-sm text-content-muted">{t("fileType",{type:library("explorer.templateType")})}</p></>;
}
