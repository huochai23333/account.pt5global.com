import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {DocumentBatch,DocumentFile,DocumentReceipt} from "./model";
import {requireDocumentReceipt,DOCUMENT_BUCKET} from "./model";
import {completeReservedDocumentUpload} from "./storage-mutations";
import {inspectDocument} from "./file-policy";
type CopyStep={completed?:boolean;source:DocumentFile;destinationId:string;operationId:string;renameOperationId:string;name:string;receipt:DocumentReceipt};
function failure(cause:unknown){const message=String((cause as {message?:string})?.message??cause);return /forbidden|permission/.test(message)?"forbidden":/folder_name_conflict/.test(message)?"folderNameConflict":/conflict/.test(message)?"conflict":/busy/.test(message)?"busy":/invalid/.test(message)?"invalid":"unconfirmed";}
/** 父目录先建立，资料再复制；每次只完成十项，原批次记录防止断线后再次生成副本。 */
export async function continueCopy(db:SupabaseClient,actor:string,batch:DocumentBatch){
 const complete=new Set(batch.results.filter(result=>result.status==="succeeded").map(result=>`${result.kind}:${result.id}`));
 const entries=batch.manifest.filter(entry=>!complete.has(`${entry.kind}:${entry.id}`)).sort((a,b)=>a.kind==="folder"&&b.kind!=="folder"?-1:a.kind!=="folder"&&b.kind==="folder"?1:a.depth-b.depth);
 for(const entry of entries.slice(0,10)){
  const args={p_id:batch.id,p_kind:entry.kind,p_item:entry.id};
  try{
   const prepared=await db.rpc("document_copy_entry",args);if(prepared.error)throw prepared.error;const step=prepared.data as CopyStep;if(step.completed)continue;
   // 先核对来源对象，不能把缺失或损坏的对象作为成功副本；保留原文件，绝不覆盖。
   const object=await db.storage.from(DOCUMENT_BUCKET).download(step.source.storage_path);if(object.error||!object.data)throw new Error("unconfirmed");const bytes=new Uint8Array(await object.data.arrayBuffer());const inspected=inspectDocument(step.source.original_name,bytes);
   if(bytes.length!==step.source.size_bytes||inspected.sha256!==step.source.sha256)throw new Error("unconfirmed");
   const reserved=await db.rpc("document_copy_entry",{...args,p_reserve:true});if(reserved.error)throw reserved.error;const current=reserved.data as CopyStep;
   const receipt=await completeReservedDocumentUpload(db,actor,requireDocumentReceipt(current.receipt,current.operationId,false),bytes,step.source.original_name);
   if(receipt.status!=="succeeded")throw new Error("unconfirmed");
   if(receipt.record.name!==current.name){const renamed=await db.rpc("document_library_command",{p_operation:current.renameOperationId,p_action:"rename_file",p_payload:{fileId:receipt.record.id,version:receipt.record.version,name:current.name}});if(renamed.error)throw renamed.error;requireDocumentReceipt(renamed.data,current.renameOperationId);}
   const recorded=await db.rpc("document_copy_result",args);if(recorded.error)throw recorded.error;
  }catch(cause){const recorded=await db.rpc("document_copy_result",{...args,p_error:failure(cause)});if(recorded.error)throw recorded.error;}
 }
 const finished=await db.rpc("document_batch_finish",{p_id:batch.id});if(finished.error)throw finished.error;return finished.data as DocumentBatch;
}
