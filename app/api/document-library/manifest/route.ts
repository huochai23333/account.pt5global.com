import {requireDocumentApi} from "@/lib/document-library/access";
import {checkDocumentOrigin,documentError,readDocumentBody} from "@/lib/document-library/http";
import {readManifest} from "@/lib/document-library/explorer-repository";
/** 确认窗显示服务器的真实清单；提交时再次比较指纹，不删除后来新增的内容。 */
export async function POST(request:Request){try{
  const {supabase}=await requireDocumentApi();checkDocumentOrigin(request);
  const body=JSON.parse((await readDocumentBody(request,65536)).toString("utf8"));
  return Response.json(await readManifest(supabase,body.items,body.write!==false));
}catch(error){return documentError(error);}}
