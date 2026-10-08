"use client";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { DashboardDialog } from "@/components/dashboard/dashboard-dialog";
import { Button } from "@/components/ui/button";
import { Field,Input } from "@/components/ui/form-controls";
import type { TemplateDocument,TemplateDocumentSummary } from "@/lib/company-templates/documents/model";
import { useDocumentActions } from "./use-document-actions";
export function DocumentActions({document,workspace,getRevision,getState,beforeRename,onChanged,disabled=false,conflict=false}: {
  document:TemplateDocumentSummary;workspace:string;getRevision:()=>number;getState?:()=>Promise<Record<string,unknown>>;
  beforeRename?:()=>Promise<boolean>;onChanged?:(document:TemplateDocument|null)=>void;disabled?:boolean;conflict?:boolean;
}){
  const t=useTranslations("CompanyTemplates.documents");const router=useRouter();
  const state=useDocumentActions(document,getRevision,getState,beforeRename,onChanged);
  async function submit(){const result=await state.submit();if(!result)return;if(state.action==="copy")router.push(`/${workspace}/company-templates/documents/${result.receipt.document_id}`);else if(state.action==="delete"&&getState)router.push(`/${workspace}/company-templates?tab=documents`);else if(!getState)router.refresh();}
  return <>
    <div className="flex flex-wrap gap-2"><Button disabled={disabled||state.busy||conflict} variant="outline" onClick={()=>state.open("rename")}>{t("rename")}</Button><Button disabled={disabled||state.busy} variant="outline" onClick={()=>state.open("copy")}>{t("copy")}</Button><Button disabled={disabled||state.busy||conflict} variant="outline" onClick={()=>state.open("delete")}>{t("delete")}</Button></div>
    <DashboardDialog open={state.action!==null} onOpenChange={open=>{if(!open)state.close();}} title={t(state.action??"rename")} description={state.action==="delete"?t("deleteNotice"):undefined}
      actions={<><Button disabled={state.busy} variant="outline" onClick={state.close}>{t("cancel")}</Button><Button disabled={state.busy||(state.action!=="delete"&&!state.name.trim())} loading={state.busy} onClick={submit}>{t("confirm")}</Button></>}>
      {state.action!=="delete"?<Field label={t("name")}><Input autoFocus maxLength={120} value={state.name} onChange={event=>state.setName(event.target.value)}/></Field>:<p className="break-words">{document.name}</p>}
      {state.error?<p role="alert" className="text-sm text-status-danger">{t(`errors.${state.error}`)}</p>:null}
    </DashboardDialog>
  </>;
}
