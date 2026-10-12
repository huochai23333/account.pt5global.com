import { documentFailure } from "@/lib/company-templates/documents/api";
import {requireDocumentApi} from "@/lib/document-library/access";
/** 返回数据库授权后的可写目录，目录名称不参与权限判断。 */
export async function GET() {
  try {
    const {supabase:db,userId} = await requireDocumentApi();
    const {data, error} = await db.rpc("template_document_destinations");
    if (error) throw error;
    if (!data || !Array.isArray(data.archives) || !Array.isArray(data.folders)) throw new Error("document_not_confirmed");
    return Response.json({...data,userId}, {headers: {"Cache-Control": "private, no-store"}});
  } catch (cause) { return documentFailure(cause); }
}
