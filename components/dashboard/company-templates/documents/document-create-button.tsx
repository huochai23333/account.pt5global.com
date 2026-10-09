"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { writeDocument, documentErrorKey } from "@/lib/company-templates/documents/client";
import type { DocumentMutation } from "@/lib/company-templates/documents/model";
import {DocumentFolderDialog, type FolderSaveChoice} from "./document-folder-dialog";
import {templateDocumentHref} from "@/lib/company-templates/documents/navigation";
/** 创建编号保留到得到最终凭证，失败重试不会多建一份空白文档。 */
export function DocumentCreateButton({ templateId, templateName, workspace }: { templateId: string; templateName: string; workspace: string }) {
  const t = useTranslations("CompanyTemplates.documents"); const router = useRouter();
  const intent = useRef<DocumentMutation | null>(null); const busyRef = useRef(false);
  const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  const [open, setOpen] = useState(false);
  const [desktop,setDesktop]=useState(false);
  useEffect(()=>{const media=window.matchMedia("(min-width: 768px)");const update=()=>setDesktop(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
  async function create(choice: FolderSaveChoice) {
    if (busyRef.current) return; busyRef.current=true;setBusy(true);setError("");
    intent.current ??= {action:"create",documentId:crypto.randomUUID(),operationId:crypto.randomUUID(),templateId,name:templateName.slice(0,100)+" "+new Date().toLocaleDateString("sv-SE"),folderId:choice.folderId,confirmShare:choice.confirmShare};
    try { const result=await writeDocument(intent.current); router.push(templateDocumentHref(workspace,result.receipt.document_id)); }
    catch(cause) {const key=documentErrorKey(cause);setError(key);if(["document_forbidden","document_invalid","document_share_confirmation","document_missing"].includes(key))intent.current=null;busyRef.current=false;setBusy(false);}
  }
  if(!desktop)return null;
  return <div className="grid gap-2"><Button disabled={busy} loading={busy} onClick={()=>{intent.current=null;setError("");setOpen(true);}}>{t(busy?"opening":"create")}</Button>{open?<DocumentFolderDialog title={t("chooseSaveFolder")} busy={busy} error={error} close={()=>setOpen(false)} submit={create}/>:null}</div>;
}
