import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {archiveBytes} from "./archive-bytes";
import {readManifest} from "./explorer-repository";
import {DOCUMENT_BUCKET,type DocumentFile,type ExplorerTarget} from "./model";
import {inspectDocument} from "./file-policy";
import {archivePaths} from "./archive-paths";
/** 打包前逐个读取并校验真实字节；任何对象缺失或内容变化都中止，不能交付缺项的压缩包。 */
export async function downloadArchive(db:SupabaseClient,items:ExplorerTarget[]){
 const manifest=await readManifest(db,items,false);
 const files=manifest.entries.filter(e=>e.kind==="file");
 if(files.length>100||files.reduce((sum,e)=>sum+Number(e.record.size_bytes),0)>200*1024*1024)throw new Error("archiveSize");
 if(!files.length&&!manifest.entries.some(e=>e.kind==="folder"))throw new Error("templateDownload");
 const bundle=new Map<string,Uint8Array>();
 const paths=archivePaths(manifest.entries);
 for(const entry of manifest.entries){
   const path=paths.get(entry.id);
   if(entry.kind==="folder"&&path){bundle.set(path,new Uint8Array());continue;}
   if(entry.kind!=="file")continue;
   if(!path)throw new Error("unconfirmed");
   const file=entry.record as unknown as DocumentFile;
   const response=await db.storage.from(DOCUMENT_BUCKET).download(file.storage_path);
   if(response.error||!response.data)throw new Error("unconfirmed");
   const bytes=new Uint8Array(await response.data.arrayBuffer());
   const inspection=inspectDocument(file.original_name,bytes);
   if(bytes.length!==file.size_bytes||inspection.sha256!==file.sha256)throw new Error("unconfirmed");
   bundle.set(path,bytes);
 }
 // 再次核对清单，拦截打包过程中移动、撤权或修改内容；不包含模板填写数据。
 const confirmed=await readManifest(db,items,false);
 if(confirmed.digest!==manifest.digest)throw new Error("conflict");
 return archiveBytes(bundle);
}
