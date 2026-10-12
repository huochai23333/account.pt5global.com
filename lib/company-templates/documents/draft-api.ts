import {MAX_DOCUMENT_BYTES} from "./model";
import type {DraftMutation} from "./draft-model";
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
/** 先限制请求大小，再白名单提取字段；创建者、固定版本与内容指纹一律由数据库决定。 */
export async function readDraftMutation(request:Request):Promise<DraftMutation>{
 const reader=request.body?.getReader();if(!reader)throw new Error("document_invalid");const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_DOCUMENT_BYTES+4096){await reader.cancel();throw new Error("document_too_large");}chunks.push(value);}
 const body=JSON.parse(Buffer.concat(chunks).toString("utf8")) as DraftMutation;
 if(!body||!["create","save","delete","promote"].includes(body.action)||!UUID.test(body.draftId)||!UUID.test(body.operationId))throw new Error("document_invalid");
 if(body.action==="create"&&!UUID.test(body.templateId??""))throw new Error("document_invalid");
 if(body.preferredFolderId!==undefined&&!UUID.test(body.preferredFolderId))throw new Error("document_invalid");
 if(body.action!=="create"&&(!Number.isInteger(body.expectedRevision)||Number(body.expectedRevision)<1))throw new Error("document_invalid");
 if(body.action==="promote"&&!UUID.test(body.folderId??""))throw new Error("document_invalid");
 if(["create","promote"].includes(body.action)&&(typeof body.name!=="string"||!body.name.trim()||body.name.trim().length>120))throw new Error("document_invalid");
 if(["save","promote"].includes(body.action)){
  if(!body.state||typeof body.state!=="object"||Array.isArray(body.state))throw new Error("document_invalid");
  if(Buffer.byteLength(JSON.stringify(body.state))>MAX_DOCUMENT_BYTES)throw new Error("document_too_large");
 }
 return{action:body.action,draftId:body.draftId,operationId:body.operationId,...(body.templateId?{templateId:body.templateId}:{}),...(body.preferredFolderId?{preferredFolderId:body.preferredFolderId}:{}),...(body.folderId?{folderId:body.folderId}:{}),...(body.name?{name:body.name.trim()}:{}),...(body.state?{state:body.state}:{}),...(body.expectedRevision!==undefined?{expectedRevision:body.expectedRevision}:{})};
}
