"use client";
import {useCallback,useEffect,useState} from "react";
import Link from "next/link";
import {useTranslations} from "next-intl";
import {useRouter} from "next/navigation";
import {Button} from "@/components/ui/button";
import {Surface} from "@/components/ui/surface";
import type {TemplateDocument} from "@/lib/company-templates/documents/model";
import {useDocumentFrame} from "./use-document-frame";
import {useDocumentSave} from "./use-document-save";
import {DocumentActions} from "./document-actions";
import {useUnsavedNavigation} from "./use-unsaved-navigation";
import {useDashboardConfirm} from "@/components/dashboard/dashboard-confirm-provider";
import {useDocumentKeyboard} from "./use-document-keyboard";
import {documentLibraryHref,templateDocumentHref} from "@/lib/company-templates/documents/navigation";
/** 编辑器只组装工具栏和窗口；数据传递、保存并发及管理弹窗由独立模块承担。 */
export function DocumentEditor({document,workspace,hasGuide}:{document:TemplateDocument;workspace:string;hasGuide:boolean}){
  const t=useTranslations("CompanyTemplates.documents");const viewer=useTranslations("CompanyTemplates.viewer");const router=useRouter();
  const library=useTranslations("Documents");
  const [name,setName]=useState(document.name);const [actionError,setActionError]=useState(false);const [copySignal,setCopySignal]=useState(0);const [dialogOpen,setDialogOpen]=useState(false);
  const confirm=useDashboardConfirm();
  const save=useDocumentSave(document);const {frame:iframeRef,desktop,load,exportNow,retry,bindSaveShortcut}=useDocumentFrame(document,save.receive,save.markDirty,save.readState);
  const canManage=document.location.can_manage;const {flush}=save;
  const saveNow=useCallback(async()=>{setActionError(false);try{await exportNow();return await flush(true);}catch{setActionError(true);return false;}},[exportNow,flush]);
  useEffect(()=>bindSaveShortcut(copy=>{if(load?.status==="ready"&&!dialogOpen){if(copy)setCopySignal(v=>v+1);else void saveNow();}}),[bindSaveShortcut,load?.status,dialogOpen,saveNow]);
  useDocumentKeyboard(copy=>{if(load?.status==="ready"&&!dialogOpen){if(copy)setCopySignal(v=>v+1);else void saveNow();}},desktop&&canManage);
  useUnsavedNavigation(save.dirty,t("leaveNotice"),t("leaveTitle"));
  async function back(){if(save.dirty&&!(await confirm({title:t("leaveTitle"),description:t("leaveNotice"),tone:"warning"})))return;router.push(documentLibraryHref(workspace,save.location));}
  async function reopen(reload:boolean){if(save.dirty&&!(await confirm({title:t("leaveTitle"),description:t("reloadNotice"),tone:"warning"})))return;if(reload)window.location.reload();else retry();}
  function changed(next:TemplateDocument|null){if(next?.id===document.id){setName(next.name);save.acceptRevision(next.revision);save.acceptLocation(next.location);} }
  return <section className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
    <Surface padding="compact" className="flex flex-col gap-3"><h2 className="break-words text-lg font-bold">{name}</h2><p className="text-sm text-content-muted">{document.template_name} · {t("folderNotice",{name:save.location.folder_system_key?library(`zones.${save.location.zone}`):save.location.folder_name})}</p>
      {hasGuide?<Link className="text-sm font-semibold text-primary" href={`${templateDocumentHref(workspace,document.id)}/guide`}>{t("guide")}</Link>:null}
      <div className="flex flex-wrap items-center gap-2"><Button variant="outline" onClick={back}>{t("back")}</Button>{desktop&&canManage?<><Button disabled={load?.status!=="ready"||save.status==="conflict"||dialogOpen} onClick={()=>void saveNow()}>{t("save")}</Button></>:null}{canManage?<DocumentActions showToolbar={desktop} document={{...document,name,folder_id:save.location.folder_id}} workspace={workspace} getRevision={()=>save.revision.current} getState={exportNow} beforeRename={saveNow} onChanged={changed} onDialogChange={open=>{setDialogOpen(open);if(open)save.pause();else save.resume();}} onDeleted={()=>router.push(documentLibraryHref(workspace,save.location))} disabled={!desktop||load?.status!=="ready"||save.status==="saving"} conflict={save.status==="conflict"} copySignal={copySignal}/>:null}
      {desktop&&!canManage?<Button disabled={load?.status!=="ready"} variant="outline" onClick={()=>iframeRef.current?.contentWindow?.postMessage({type:"pt5.document.print",token:load?.token},"*")}>{t("print")}</Button>:null}</div>
      {!canManage?<p className="text-sm text-content-muted">{t("readOnly")}</p>:null}
      {/* 窗口加载已经失败时，应给出重试提示，不能仍显示“正在打开文档”。 */}
      {desktop?<p role="status" aria-live="polite" className="text-sm">{load?.status==="failed"?viewer("loadFailed"):canManage?t(`status.${save.status}`):load?.status==="ready"?t("readOnlyReady"):t("status.loading")}</p>:null}
      {save.error?<p role="alert" className="text-sm text-status-danger">{t(`errors.${save.error}`)}</p>:null}
      {actionError?<p role="alert">{t("errors.document_failed")}</p>:null}
      {save.status==="failed"?<Button onClick={()=>void saveNow()}>{t("retry")}</Button>:null}
      {save.status==="conflict"?<Button variant="outline" onClick={()=>void reopen(true)}>{t("reload")}</Button>:null}
    </Surface>
    {!desktop?<p className="p-6 text-center text-sm text-content-muted">{viewer("desktopOnly")}</p>:<Surface padding={null} className="relative overflow-hidden min-h-[680px]">
      {load?.status!=="ready"?<div role="status" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface-panel p-4"><p>{viewer(load?.status==="failed"?"loadFailed":"loading")}</p>{load?.status==="failed"?<Button onClick={()=>void reopen(false)}>{viewer("retry")}</Button>:null}</div>:null}
      {load?<iframe ref={iframeRef} key={load.token} src={load.src} title={name} sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-popups" referrerPolicy="no-referrer" className="h-[calc(100vh-16rem)] min-h-[680px] w-full bg-surface-panel"/>:null}
    </Surface>}
  </section>;
}
