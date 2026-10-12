import {documentAccess,documentFailure} from "@/lib/company-templates/documents/api";
import {checkDocumentOrigin} from "@/lib/document-library/http";
import {readDraftMutation} from "@/lib/company-templates/documents/draft-api";
import {listDrafts,mutateDraft} from "@/lib/company-templates/documents/draft-repository";
/** 草稿列表只由当前身份读取；创建与保存仍须通过来源核对和数据库版本检查。 */
export async function GET(request:Request){try{const db=await documentAccess();const url=new URL(request.url);const page=Math.max(1,Math.min(10000,Number(url.searchParams.get("page"))||1));return Response.json(await listDrafts(db,(url.searchParams.get("search")??"").slice(0,120),Math.floor(page)),{headers:{"Cache-Control":"private, no-store"}});}catch(cause){return documentFailure(cause);}}
export async function POST(request:Request){try{const db=await documentAccess();checkDocumentOrigin(request);return Response.json(await mutateDraft(db,await readDraftMutation(request)),{headers:{"Cache-Control":"private, no-store"}});}catch(cause){return documentFailure(cause);}}
