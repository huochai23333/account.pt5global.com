"use client";
import {useState} from "react";
import {useTranslations} from "next-intl";
import {DashboardDialog} from "@/components/dashboard/dashboard-dialog";
import {Button} from "@/components/ui/button";
import {useSaveAsBrowser} from "./use-save-as-browser";
import {SaveAsTree} from "./save-as-tree";
import {SaveAsFiles} from "./save-as-files";
import {SaveAsNavigation,useSaveAsPath} from "./save-as-navigation";
import {SaveAsNewFolder} from "./save-as-new-folder";
import {SaveAsNameForm,useSaveAsName} from "./save-as-name-form";
import type {FolderSaveChoice} from "./document-folder-dialog";
/** 弹窗组装导航、目录树和文件区；新建子目录和表单提交的等待状态互不冒充成功。 */
export function DocumentSaveAsDialog({currentFolderId,initialName,busy,error,close,submit,canSubmit=true,recovering=false}:{currentFolderId?:string;initialName:string;busy:boolean;error:string;close:()=>void;submit:(choice:FolderSaveChoice)=>Promise<unknown>;canSubmit?:boolean;recovering?:boolean}){
 const t=useTranslations("CompanyTemplates.documents");const browser=useSaveAsBrowser(currentFolderId);const [name,setName]=useSaveAsName(initialName);const [newFolder,setNewFolder]=useState(false);const [creating,setCreating]=useState(false);
 const {path}=useSaveAsPath(browser);const locked=busy||creating;const formLocked=locked||recovering;const allowed=!locked&&canSubmit&&!browser.loading&&!browser.error&&Boolean(browser.folder)&&Boolean(name.trim())&&!newFolder;
 function save(){if(allowed)void submit({folderId:browser.folderId,name:name.trim()});}
 return <DashboardDialog open contentClassName="px-4 py-3 sm:px-6 sm:py-4" title={t("saveAs")} onOpenChange={open=>{if(!open&&!locked)close();}} actions={<><Button variant="outline" disabled={locked} onClick={close}>{t("cancel")}</Button><Button loading={busy} disabled={!allowed} onClick={save}>{t("save")}</Button></>}>
  <div className="grid min-w-0 gap-3">
   <SaveAsNavigation browser={browser} busy={formLocked} onNewFolder={()=>setNewFolder(true)}/>
   {newFolder&&<SaveAsNewFolder browser={browser} busy={busy} onBusyChange={setCreating} close={()=>setNewFolder(false)}/>}
   {browser.directoryError?<div role="alert"><p>{t("errors.document_failed")}</p><Button onClick={()=>void browser.loadDirectories()}>{t("retry")}</Button></div>:<div className="grid h-[clamp(150px,calc(100dvh-560px),320px)] min-h-0 min-w-0 grid-cols-[minmax(95px,26%)_minmax(0,1fr)] gap-3 rounded-lg border border-border-subtle p-2"><SaveAsTree browser={browser} busy={formLocked}/><SaveAsFiles browser={browser} busy={formLocked} setName={setName}/></div>}
   <p data-save-as-path className="max-h-20 overflow-y-auto break-words text-sm text-content-muted [overflow-wrap:anywhere]">{t("folderSelected",{path})}</p>
   <SaveAsNameForm name={name} setName={setName} locked={formLocked} onSubmit={save}/>
   {/* 未确认的请求只能续办原位置和名称，避免屏幕显示的新目的地与实际保存位置不同。 */}
   {recovering&&<p className="text-sm text-content-muted">{t("recoveryNotice")}</p>}
   {error&&<p role="alert" className="text-sm text-status-danger">{t(`errors.${["document_conflict","document_name_conflict","document_forbidden","document_invalid","document_not_confirmed","document_too_large"].includes(error)?error:"document_failed"}`)}</p>}
  </div>
 </DashboardDialog>;
}
