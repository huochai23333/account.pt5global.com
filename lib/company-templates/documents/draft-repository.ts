import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import {withRequestTimeout} from "@/lib/request-timeout";
import {canonicalState} from "./model";
import type {DraftMutation,DraftReceipt,TemplateDraft,DraftSummary} from "./draft-model";
import {readTemplateDocument} from "./repository";
const SUMMARY="id,owner_id,template_id,template_version_id,template_name,name,preferred_folder_id,revision,updated_at";
/** 使用当前账号客户端，RLS 在计数、分页及正文前过滤，管理员也不能读取其他人的草稿。 */
export async function listDrafts(db:SupabaseClient,search="",page=1){
 let query=db.from("company_template_document_drafts").select(SUMMARY,{count:"exact"}).order("updated_at",{ascending:false}).order("id").range((page-1)*20,page*20-1);
 if(search)query=query.ilike("name",`%${search.replace(/[\\%_]/g,"\\$&")}%`);
 const {data,count,error}=await withRequestTimeout(query);if(error)throw error;return{drafts:(data??[]) as DraftSummary[],total:count??0,page};
}
export async function readDraft(db:SupabaseClient,id:string){const {data,error}=await withRequestTimeout(db.from("company_template_document_drafts").select(`${SUMMARY},state,state_sha256`).eq("id",id).maybeSingle());if(error)throw error;return data as TemplateDraft|null;}
/** 转正后原地址通过原凭证显示结果，不能因草稿已移除就猜测创建成功。 */
export async function readPromotedDraft(db:SupabaseClient,id:string){
 const {data,error}=await withRequestTimeout(db.from("company_template_draft_operations").select("receipt").eq("draft_id",id).eq("receipt->>action","promote").limit(1).maybeSingle());if(error)throw error;
 return data?readTemplateDocument(db,id):null;
}
export async function mutateDraft(db:SupabaseClient,input:DraftMutation){
 const {data,error}=await withRequestTimeout(db.rpc("mutate_template_document_draft",{_request:input}));if(error)throw error;const receipt=data as DraftReceipt;
 if(!receipt||receipt.draft_id!==input.draftId||receipt.action!==input.action||receipt.affected_rows!==1)throw new Error("document_not_confirmed");
 // 函数返回值之外，再按原操作编号读取持久凭证；删除草稿后凭证仍在，转正后还会重新核对目录权限。
 const {data:proof,error:proofError}=await withRequestTimeout(db.from("company_template_draft_operations").select("receipt").eq("operation_id",input.operationId).eq("draft_id",input.draftId).maybeSingle());
 if(proofError||!proof||canonicalState(proof.receipt)!==canonicalState(receipt))throw new Error("document_not_confirmed");
 const draft=await readDraft(db,input.draftId);const document=input.action==="promote"?await readTemplateDocument(db,input.draftId):null;
 // 原请求已完成后若另一窗口又保存了新修订，应停止重试并提示重新打开，不能把它当成普通断线继续重送。
 const actual=document??draft;if(input.action!=="delete"&&actual&&actual.revision>receipt.revision)throw new Error("document_conflict");
 if(input.action==="delete"?draft!==null:input.action==="promote"?draft!==null||!document||document.folder_id!==input.folderId||document.revision!==receipt.revision||document.state_sha256!==receipt.state_sha256:!draft||draft.revision!==receipt.revision||draft.state_sha256!==receipt.state_sha256)throw new Error("document_not_confirmed");
 if(actual&&input.state&&canonicalState(actual.state)!==canonicalState(input.state))throw new Error("document_not_confirmed");
 if(actual&&input.name&&actual.name!==input.name.trim())throw new Error("document_not_confirmed");return{receipt,draft,document};
}
