"use client";
import {useTranslations} from "next-intl";
import {Button} from "@/components/ui/button";
import type {DocumentBatchSummary} from "@/lib/document-library/model";
/** 成功项、失败项分别显示；处理中的批次只能继续核对，不能冒充已经完成。 */
export function ExplorerBatchResults({batches,busy,resume,release}:{batches:DocumentBatchSummary[];busy:boolean;resume:(id:string)=>void;release:(id:string)=>void}){
 const t=useTranslations("Documents");if(!batches.length)return null;
 // 完成时自动收起明细；未完成的批次保留可见续办按钮，不能因压缩通知丢失失败结果。
 return <div className="space-y-2">{batches.map(batch=><details key={`${batch.id}:${batch.status}`} open={batch.status!=="succeeded"} data-document-batch={batch.id} data-batch-status={batch.status} className="rounded-xl border border-border-subtle text-sm">
  <summary className="min-h-11 cursor-pointer px-3 py-3"><span role="status">{t(`explorer.batch_${batch.status}`,{done:batch.results.filter(r=>r.status==="succeeded").length,total:batch.total??batch.results.length})}</span><span className="ms-3 text-primary">{t("explorer.activityDetails")}</span></summary>
  <div className="border-t border-border-subtle p-3">
   {batch.results.length>0&&<ul aria-label={t("explorer.operationDetails")} className="max-h-40 space-y-1 overflow-auto">{batch.results.map(r=><li key={`${r.kind}:${r.id}`} className={`break-words [overflow-wrap:anywhere] ${r.status==="succeeded"?"text-status-success":"text-status-danger"}`}>{r.name} · {r.status==="succeeded"?t("explorer.itemCompleted"):r.status==="pending"?t("explorer.itemChecking"):t(`errors.${["busy","folderNameConflict","forbidden","folderNotEmpty","shareConfirmation","conflict"].includes(r.error??"")?r.error:"unconfirmed"}`)}</li>)}</ul>}
   {batch.status!=="succeeded"&&<div className="mt-2 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={()=>resume(batch.id)}>{t("reconcile")}</Button><Button variant="outline" disabled={busy} onClick={()=>release(batch.id)}>{t("explorer.endBatch")}</Button></div>}
  </div>
 </details>)}</div>;
}
