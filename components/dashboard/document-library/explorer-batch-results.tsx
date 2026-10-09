"use client";
import {useTranslations} from "next-intl";
import {Button} from "@/components/ui/button";
import type {DocumentBatchSummary} from "@/lib/document-library/model";
/** 成功项、失败项分别显示；处理中的批次只能继续核对，不能冒充已经完成。 */
export function ExplorerBatchResults({batches,busy,resume,release}:{batches:DocumentBatchSummary[];busy:boolean;resume:(id:string)=>void;release:(id:string)=>void}){
 const t=useTranslations("Documents");if(!batches.length)return null;
 return <div className="space-y-3">{batches.map(batch=><div key={batch.id} data-document-batch={batch.id} data-batch-status={batch.status} role="status" className="rounded-xl border border-border-subtle p-3 text-sm">
  <p>{t(`explorer.batch_${batch.status}`,{done:batch.results.filter(r=>r.status==="succeeded").length,total:batch.total??batch.results.length})}</p>
  {batch.results.length>0&&<ul className="mt-2 max-h-48 space-y-1 overflow-auto">{batch.results.map(r=><li key={`${r.kind}:${r.id}`} className={`break-words [overflow-wrap:anywhere] ${r.status==="succeeded"?"text-status-success":"text-status-danger"}`}>{r.name} · {r.status==="succeeded"?t("explorer.itemCompleted"):r.status==="pending"?t("explorer.itemChecking"):t(`errors.${["busy","folderNameConflict","forbidden","folderNotEmpty","shareConfirmation","conflict"].includes(r.error??"")?r.error:"unconfirmed"}`)}</li>)}</ul>}
  {batch.status!=="succeeded"&&<div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>resume(batch.id)}>{t("reconcile")}</Button><Button variant="outline" disabled={busy} onClick={()=>release(batch.id)}>{t("explorer.endBatch")}</Button></div>}
 </div>)}</div>;
}
