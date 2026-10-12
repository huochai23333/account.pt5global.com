import {documentAccess,documentFailure} from "@/lib/company-templates/documents/api";
import {readDraft,readPromotedDraft} from "@/lib/company-templates/documents/draft-repository";
/** 转正是本次草稿生命周期的结果；其他人的编号不能作为读取权限。 */
export async function GET(_request:Request,{params}:{params:Promise<{draftId:string}>}){try{const db=await documentAccess();const {draftId}=await params;const draft=await readDraft(db,draftId);const document=draft?null:await readPromotedDraft(db,draftId);return Response.json({draft,document},{headers:{"Cache-Control":"private, no-store"}});}catch(cause){return documentFailure(cause);}}
