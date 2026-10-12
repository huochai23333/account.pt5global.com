"use client";
import {useEffect,useRef,useState} from "react";
import {useRouter} from "next/navigation";
import {useTranslations} from "next-intl";
import {Button} from "@/components/ui/button";
import {writeDraft} from "@/lib/company-templates/documents/draft-client";
import {documentErrorKey} from "@/lib/company-templates/documents/client";
import type {DraftMutation} from "@/lib/company-templates/documents/draft-model";
/** 直接建立自己的云端草稿，位置仅是未来另存为的预选提示；重试保留编号避免空白副本。 */
export function DocumentCreateButton({templateId,templateName,workspace,currentFolderId}:{templateId:string;templateName:string;workspace:string;currentFolderId?:string}){
 const t=useTranslations("CompanyTemplates.documents");const router=useRouter();const intent=useRef<DraftMutation|null>(null);const running=useRef(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");const [desktop,setDesktop]=useState(false);
 useEffect(()=>{const media=window.matchMedia("(min-width: 768px)");const update=()=>setDesktop(media.matches);update();media.addEventListener("change",update);return()=>media.removeEventListener("change",update);},[]);
 async function create(){if(running.current)return;running.current=true;setBusy(true);setError("");intent.current??={action:"create",draftId:crypto.randomUUID(),operationId:crypto.randomUUID(),templateId,name:templateName.slice(0,100)+" "+new Date().toLocaleDateString("sv-SE"),...(currentFolderId?{preferredFolderId:currentFolderId}:{})};
  try{const result=await writeDraft(intent.current);router.push(`/${workspace}/documents/drafts/${result.receipt.draft_id}`);}catch(cause){const key=documentErrorKey(cause);setError(key);if(["document_forbidden","document_invalid","document_missing"].includes(key))intent.current=null;running.current=false;setBusy(false);}
 }
 if(!desktop)return null;return <div className="grid gap-2"><Button loading={busy} onClick={()=>void create()}>{t(busy?"opening":"create")}</Button>{error&&<p role="alert" className="text-sm text-status-danger">{t(`errors.${error}`)}</p>}</div>;
}
