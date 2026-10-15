import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {DocumentReceipt} from "./model";
/** 操作凭证和当前记录分别读取；名称、位置或版本不符时保留未确认结果。 */
export async function verifyNamedDocument(db:SupabaseClient,receipt:DocumentReceipt,payload:Record<string,unknown>){
 const action=receipt.action;
 if(!["create_folder","create_default_folder","rename_folder","rename_file"].includes(action))return receipt;
 if(receipt.status!=="succeeded"||receipt.affectedCount!==1)throw new Error("unconfirmed");
 const folder=action!=="rename_file";const expected=receipt.record;
 const result=await db.from(folder?"document_folders":"document_files").select("*").eq("id",expected.id).maybeSingle();
 const actual=result.data as Record<string,unknown>|null;
 const fields=folder?["id","version","name","archive_id","parent_id","zone"]:["id","version","name","folder_id","status","sha256","storage_path","size_bytes"];
 if(result.error||!actual||fields.some(key=>actual[key]!== (expected as unknown as Record<string,unknown>)[key]))throw new Error("unconfirmed");
 const name=String(payload.name??"").trim();
 if(action==="create_default_folder"){
  const base=name||"新建文件夹";const suffix=String(actual.name).slice(base.length);
  if(actual.name!==base&&(!String(actual.name).startsWith(base)||!/^ \([2-9]\d*\)$|^ \(1\d+\)$/.test(suffix)))throw new Error("unconfirmed");
 }else if(actual.name!==name)throw new Error("unconfirmed");
 // 创建和改名核对用户发起操作时的目录或记录，不能只让响应与自己的旧凭证相互证明。
 if(action.startsWith("create_")?actual.parent_id!==payload.folderId:actual.id!==(folder?payload.folderId:payload.fileId)||actual.version!==Number(payload.version)+1)throw new Error("unconfirmed");
 return receipt;
}
