"use client";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import { Field,Input } from "@/components/ui/form-controls";
import type { TemplateDocument,TemplateDocumentSummary } from "@/lib/company-templates/documents/model";
import { useDocumentActions } from "./use-document-actions";
import {DocumentFolderDialog,type FolderSaveChoice} from "./document-folder-dialog";
import {templateDocumentHref} from "@/lib/company-templates/documents/navigation";
export function DocumentActions({document,workspace,getRevision,getState,beforeRename,onChanged,onDialogChange,onDeleted,disabled=false,conflict=false}: {
  document:TemplateDocumentSummary;workspace:string;getRevision:()=>number;getState?:()=>Promise<Record<string,unknown>>;
  beforeRename?:()=>Promise<boolean>;onChanged?:(document:TemplateDocument|null)=>void;disabled?:boolean;conflict?:boolean;
  onDialogChange?:(open:boolean)=>void;onDeleted?:()=>void;
}){
  const t=useTranslations("CompanyTemplates.documents");const router=useRouter();
  const state=useDocumentActions(document,getRevision,getState,beforeRename,onChanged,onDialogChange);
  async function submit(choice?:FolderSaveChoice){const action=state.action;const result=await state.submit(choice);if(!result)return;if(action==="copy")router.push(templateDocumentHref(workspace,result.receipt.document_id));else if(action==="delete")onDeleted?.();else if(!getState)router.refresh();}
  return <>
    <div className="flex flex-wrap gap-2"><Button disabled={disabled||state.busy||conflict} variant="outline" onClick={()=>state.open("rename")}>{t("rename")}</Button><Button disabled={disabled||state.busy} variant="outline" onClick={()=>state.open("copy")}>{t("copy")}</Button><Button disabled={disabled||state.busy||conflict} variant="outline" onClick={()=>state.open("move")}>{t("move")}</Button><Button disabled={disabled||state.busy||conflict} variant="outline" onClick={()=>state.open("delete")}>{t("delete")}</Button></div>
    {state.action==="copy"||state.action==="move"?<DocumentFolderDialog title={t(state.action)} currentFolderId={document.folder_id} initialName={state.action==="copy"?state.name:undefined} busy={state.busy} error={state.error} close={state.close} submit={submit}/>:<DashboardDialog open={state.action!==null} onOpenChange={open=>{if(!open)state.close();}} title={t(state.action??"rename")} description={state.action==="delete"?t("deleteNotice"):undefined}
      actions={<><Button disabled={state.busy} variant="outline" onClick={state.close}>{t("cancel")}</Button><Button disabled={state.busy||(state.action!=="delete"&&!state.name.trim())} loading={state.busy} onClick={()=>void submit()}>{t("confirm")}</Button></>}>
      {state.action!=="delete"?<Field label={t("name")}><Input autoFocus maxLength={120} value={state.name} onChange={event=>state.setName(event.target.value)}/></Field>:<p className="break-words">{document.name}</p>}
      {state.error?<p role="alert" className="text-sm text-status-danger">{t(`errors.${state.error}`)}</p>:null}
    </DashboardDialog>}
  </>;
}
