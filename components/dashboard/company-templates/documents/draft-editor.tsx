"use client";
import {useEffect} from "react";
import {useRouter} from "next/navigation";
import {useTranslations} from "next-intl";
import {Button} from "@/components/ui/button";
import {Surface} from "@/components/ui/surface";
import type {TemplateDraft} from "@/lib/company-templates/documents/draft-model";
import {useDraftSave} from "./use-draft-save";
import {useDocumentFrame} from "./use-document-frame";
import {useDraftPromotion} from "./use-draft-promotion";
import {useDocumentKeyboard} from "./use-document-keyboard";
import {DocumentSaveAsDialog} from "./document-save-as-dialog";
import {useUnsavedNavigation} from "./use-unsaved-navigation";
import {useDashboardConfirm} from "@/components/dashboard/dashboard-confirm-provider";
/** 草稿页只组装窗口和工具栏；云端保存、窗口桥和转正弹窗由独立控制器承担。 */
export function DraftEditor({draft,workspace}:{draft:TemplateDraft;workspace:string}){
 const t=useTranslations("CompanyTemplates.documents");const viewer=useTranslations("CompanyTemplates.viewer");const router=useRouter();const confirm=useDashboardConfirm();const save=useDraftSave(draft);
 // 回调由窗口桥 ref 转发，窗口准备完成前不会接受保存命令。
 const {frame:iframeRef,desktop,load,exportNow,retry,bindSaveShortcut}=useDocumentFrame(draft,save.receive,save.markDirty,save.readState);
 const promotion=useDraftPromotion(draft,save,exportNow,id=>router.push(`/${workspace}/documents/templates/${id}`));
 useEffect(()=>bindSaveShortcut(()=>{if(load?.status==="ready"&&!promotion.open&&!promotion.busy&&save.status!=="conflict")promotion.show();}),[bindSaveShortcut,load?.status,promotion,save.status]);
 useDocumentKeyboard(()=>{if(load?.status==="ready"&&!promotion.open&&!promotion.busy&&save.status!=="conflict")promotion.show();},desktop);useUnsavedNavigation(save.dirty,t("leaveNotice"),t("leaveTitle"));
 async function leave(reload=false){if(save.dirty&&!await confirm({title:t("leaveTitle"),description:t("leaveNotice"),tone:"warning"}))return;if(reload)window.location.reload();else router.push(`/${workspace}/company-templates`);}
 return <section className="mx-auto flex w-full max-w-[1600px] flex-col gap-4"><Surface padding="compact" className="grid gap-3"><h2 className="break-words text-lg font-bold">{draft.name}</h2><p className="text-sm text-content-muted">{t("draftNotice")}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={()=>void leave()}>{t("draftBack")}</Button>{desktop&&<><Button disabled={load?.status!=="ready"||save.status==="conflict"||promotion.busy||promotion.open} onClick={promotion.show}>{t("save")}</Button><Button variant="outline" disabled={load?.status!=="ready"||save.status==="conflict"||promotion.busy||promotion.open} onClick={promotion.show}>{t("saveAs")}</Button>{save.status==="failed"&&<Button variant="outline" disabled={load?.status!=="ready"||promotion.open||promotion.busy} onClick={()=>void save.retrySave(exportNow)}>{t("retry")}</Button>}{save.status==="conflict"&&<Button variant="outline" onClick={()=>void leave(true)}>{t("reload")}</Button>}</>}</div>{desktop&&<p role="status" aria-live="polite">{load?.status==="failed"?viewer("loadFailed"):t(`draftStatus.${save.status}`)}</p>}{save.error&&<p role="alert" className="text-status-danger">{t(`errors.${save.error}`)}</p>}</Surface>
  {!desktop?<p className="p-6 text-center">{viewer("desktopOnly")}</p>:<Surface padding={null} className="relative min-h-[680px] overflow-hidden">{load?.status!=="ready"&&<div role="status" className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface-panel"><p>{viewer(load?.status==="failed"?"loadFailed":"loading")}</p>{load?.status==="failed"&&<Button onClick={retry}>{viewer("retry")}</Button>}</div>}{load&&<iframe ref={iframeRef} key={load.token} src={load.src} title={draft.name} sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-popups" referrerPolicy="no-referrer" className="h-[calc(100vh-16rem)] min-h-[680px] w-full bg-surface-panel"/>}</Surface>}
  {promotion.open&&<DocumentSaveAsDialog currentFolderId={draft.preferred_folder_id??undefined} initialName={draft.name} canSubmit={desktop&&load?.status==="ready"} busy={promotion.busy} recovering={promotion.recovering} error={promotion.error} close={promotion.close} submit={promotion.submit}/>}
 </section>;
}
