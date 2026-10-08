"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { writeDocument, documentErrorKey } from "@/lib/company-templates/documents/client";
import type { DocumentMutation } from "@/lib/company-templates/documents/model";
/** 创建编号保留到得到最终凭证，失败重试不会多建一份空白文档。 */
export function DocumentCreateButton({ templateId, templateName, workspace }: { templateId: string; templateName: string; workspace: string }) {
  const t = useTranslations("CompanyTemplates.documents"); const router = useRouter();
  const intent = useRef<DocumentMutation | null>(null); const busyRef = useRef(false);
  const [busy,setBusy] = useState(false); const [error,setError] = useState("");
  const [desktop,setDesktop]=useState(false);
  useEffect(()=>{const media=window.matchMedia("(min-width: 768px)");const update=()=>setDesktop(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
  async function create() {
    if (busyRef.current) return; busyRef.current=true;setBusy(true);setError("");
    intent.current ??= {action:"create",documentId:crypto.randomUUID(),operationId:crypto.randomUUID(),templateId,name:templateName.slice(0,100)+" "+new Date().toLocaleDateString("sv-SE")};
    try { const result=await writeDocument(intent.current); router.push(`/${workspace}/company-templates/documents/${result.receipt.document_id}`); }
    catch(cause) {setError(t(`errors.${documentErrorKey(cause)}`));busyRef.current=false;setBusy(false);}
  }
  if(!desktop)return null;
  return <div className="grid gap-2"><Button disabled={busy} loading={busy} onClick={create}>{t(busy?"opening":"create")}</Button>{error?<p role="alert" className="text-sm text-status-danger">{error}</p>:null}</div>;
}
