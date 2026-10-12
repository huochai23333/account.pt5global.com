import type {DraftMutation,DraftReceipt,TemplateDraft} from "./draft-model";
import type {TemplateDocument} from "./model";
import {canonicalState} from "./model";
/** 页面只接受服务端已独立读回的结果；断线重试必须沿用同一个请求和操作编号。 */
export async function writeDraft(input:DraftMutation){
 const response=await fetch("/api/company-template-document-drafts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),signal:AbortSignal.timeout(30000)});
 const result=await response.json() as {error?:string;receipt:DraftReceipt;draft:TemplateDraft|null;document:TemplateDocument|null};
 if(!response.ok)throw new Error(result.error??"document_failed");
 if(result.receipt?.draft_id!==input.draftId||result.receipt.action!==input.action||result.receipt.affected_rows!==1)throw new Error("document_not_confirmed");
 if(input.action==="delete"&&result.receipt.deleted!==true)throw new Error("document_not_confirmed");
 const actual=input.action==="promote"?result.document:result.draft;
 if(input.action==="delete"?actual!==null:!actual||actual.id!==input.draftId||actual.revision!==result.receipt.revision||actual.state_sha256!==result.receipt.state_sha256)throw new Error("document_not_confirmed");
 if(input.action==="promote"&&(result.draft!==null||result.document?.folder_id!==input.folderId))throw new Error("document_not_confirmed");
 if(actual&&input.state&&canonicalState(actual.state)!==canonicalState(input.state))throw new Error("document_not_confirmed");return result;
}
