import { documentAccess, documentFailure } from "@/lib/company-templates/documents/api";
/** 返回数据库授权后的可写目录，目录名称不参与权限判断。 */
export async function GET() {
  try {
    const db = await documentAccess();
    const {data, error} = await db.rpc("template_document_destinations");
    if (error) throw error;
    if (!data || !Array.isArray(data.archives) || !Array.isArray(data.folders)) throw new Error("document_not_confirmed");
    return Response.json(data, {headers: {"Cache-Control": "private, no-store"}});
  } catch (cause) { return documentFailure(cause); }
}
