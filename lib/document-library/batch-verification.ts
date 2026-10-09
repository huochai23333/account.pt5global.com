import "server-only";
import {getSupabaseServiceRoleClient} from "@/lib/supabase-admin-server";
import {DOCUMENT_BUCKET,type DocumentBatch} from "./model";
/** 当前用户已通过批次授权后，再按固定清单独立查记录；不将管理客户端读取结果直接发给浏览器。 */
export async function verifyBatch(batch:DocumentBatch){
 if(batch.status!=="succeeded")return;
 if(batch.results.length!==batch.manifest.length||batch.results.some(r=>r.status!=="succeeded"))throw new Error("unconfirmed");
 const db=getSupabaseServiceRoleClient();const entries=batch.action==="move"?batch.snapshot:batch.manifest;
 const actualRows=new Map<string,Record<string,unknown>>();
 for(const kind of ["file","folder","template"] as const){
  const ids=entries.filter(e=>e.kind===kind).map(e=>e.id);const table=kind==="file"?"document_files":kind==="folder"?"document_folders":"company_template_documents";
  for(let offset=0;offset<ids.length;offset+=100){
   const read=await db.from(table).select(kind==="template"?"id,folder_id,revision,state_sha256,template_version_id":"*").in("id",ids.slice(offset,offset+100));
   if(read.error)throw new Error("unconfirmed");
   for(const row of (read.data??[]) as unknown as Record<string,unknown>[])actualRows.set(`${kind}:${row.id}`,row);
  }
 }
 const destination=batch.action==="move"?await db.from("document_folders").select("id,archive_id,zone").eq("id",batch.request.destinationId).single():null;
 if(destination?.error)throw new Error("unconfirmed");
 for(const entry of entries){
  const actual=actualRows.get(`${entry.kind}:${entry.id}`);
  if(batch.action==="delete"){
   if(actual)throw new Error("unconfirmed");
   if(entry.kind==="file"){
    const missing=await db.storage.from(DOCUMENT_BUCKET).exists(String(entry.record.storage_path));
    if(missing.data!==false||(missing.error&&![400,404].includes(Number((missing.error as {status?:number}).status))))throw new Error("unconfirmed");
   }
   continue;
  }
  if(!actual||Number(actual[entry.kind==="template"?"revision":"version"])!==entry.version+1)throw new Error("conflict");
  if(entry.kind==="folder"){
   if(actual.archive_id!==destination!.data.archive_id||actual.zone!==destination!.data.zone||actual.parent_id!==(entry.path.length===1?batch.request.destinationId:entry.record.parent_id))throw new Error("unconfirmed");
  }else{
   if(actual.folder_id!==(entry.path.length===1?batch.request.destinationId:entry.folderId))throw new Error("unconfirmed");
   if(entry.kind==="file"&&(actual.storage_path!==entry.record.storage_path||actual.sha256!==entry.record.sha256))throw new Error("unconfirmed");
   if(entry.kind==="template"&&(actual.state_sha256!==entry.record.state_sha256||actual.template_version_id!==entry.record.template_version_id))throw new Error("unconfirmed");
  }
 }
}
