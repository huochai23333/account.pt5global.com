import "server-only";
import {getSupabaseServiceRoleClient} from "@/lib/supabase-admin-server";
import {DOCUMENT_BUCKET,type DocumentBatch} from "./model";
import {inspectDocument} from "./file-policy";
/** 成功复制必须独立核对新记录和对象；旧记录仍存在不能用来冒充副本。 */
export async function verifyCopy(batch:DocumentBatch){
 const db=getSupabaseServiceRoleClient();const copies=new Map(batch.results.map(result=>[`${result.kind}:${result.id}`,result.receipt as {document_id?:string;revision?:number;folder_id?:string;record?:Record<string,unknown>}]));
 const destination=await db.from("document_folders").select("archive_id,zone").eq("id",batch.request.destinationId).single();if(destination.error)throw new Error("unconfirmed");
 for(const entry of batch.manifest){
  const receipt=copies.get(`${entry.kind}:${entry.id}`)!;const id=entry.kind==="template"?receipt.document_id:String(receipt.record?.id??"");if(!id||id===entry.id)throw new Error("unconfirmed");
  const table=entry.kind==="template"?"company_template_documents":entry.kind==="folder"?"document_folders":"document_files";const read=await db.from(table).select("*").eq("id",id).single();if(read.error)throw new Error("unconfirmed");const actual=read.data as Record<string,unknown>;
  const parentId=entry.kind==="folder"?String(entry.record.parent_id):entry.folderId;const parent=copies.get(`folder:${parentId}`)?.record?.id;const expectedFolder=entry.path.length===1?batch.request.destinationId:parent;
  if(entry.kind==="folder"){if(actual.parent_id!==expectedFolder||actual.archive_id!==destination.data.archive_id||actual.zone!==destination.data.zone||actual.system_key!==null||actual.version!==receipt.record?.version)throw new Error("unconfirmed");}
  else{
   if(actual.folder_id!==expectedFolder)throw new Error("unconfirmed");
   if(entry.kind==="template"){if(actual.revision!==receipt.revision||actual.state_sha256!==entry.record.state_sha256||actual.template_version_id!==entry.record.template_version_id)throw new Error("unconfirmed");}
   else{if(actual.version!==receipt.record?.version||actual.sha256!==entry.record.sha256||actual.storage_path===entry.record.storage_path||actual.status!=="ready")throw new Error("unconfirmed");const object=await db.storage.from(DOCUMENT_BUCKET).download(String(actual.storage_path));if(object.error||!object.data||object.data.size!==actual.size_bytes)throw new Error("unconfirmed");if(inspectDocument(String(actual.original_name),new Uint8Array(await object.data.arrayBuffer())).sha256!==actual.sha256)throw new Error("unconfirmed");}
  }
 }
}
