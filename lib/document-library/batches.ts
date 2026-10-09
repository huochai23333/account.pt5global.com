import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {verifyBatch} from "./batch-verification";
import {completeDocumentDelete} from "./storage-mutations";
import {requireDocumentReceipt,type DocumentBatch,type BatchResult} from "./model";

export async function readBatch(db:SupabaseClient,id:string):Promise<DocumentBatch>{
  const {data,error}=await db.from("document_batches").select("*").eq("id",id).maybeSingle();
  if(error||!data)throw new Error("forbidden");
  await verifyBatch(data);
  return data;
}
/** 一次最多处理十项，较大目录由页面接着办理；关闭页面后原清单仍保存在数据库。 */
export async function continueBatch(db:SupabaseClient,actor:string,id:string):Promise<DocumentBatch>{
  const batch=await readBatch(db,id);
  if(batch.request.released)throw new Error("conflict");
  if(batch.status==="succeeded")return batch;
  const completed=new Set(batch.results.filter(r=>r.status==="succeeded").map(r=>`${r.kind}:${r.id}`));
  const entries=batch.manifest.filter(e=>!completed.has(`${e.kind}:${e.id}`)).sort((a,b)=>{
    // 先删实际资料，后删叶子目录；父目录只有内容全部核对清空后才会被数据库允许删除。
    if(a.kind!=="folder"&&b.kind==="folder")return -1;
    if(a.kind==="folder"&&b.kind!=="folder")return 1;
    return b.depth-a.depth;
  });
  for(const entry of entries.slice(0,10)){
    const {data,error}=await db.rpc("document_batch_step",{p_id:id,p_kind:entry.kind,p_item:entry.id});
    if(error)throw error;
    const outcome=data as BatchResult;
    if(batch.action==="delete"&&entry.kind==="file"&&outcome.status==="pending"){
      await completeDocumentDelete(db,actor,requireDocumentReceipt(outcome.receipt,outcome.operationId,false));
    }
  }
  const result=await db.rpc("document_batch_finish",{p_id:id});
  if(result.error)throw result.error;
  return result.data;
}
