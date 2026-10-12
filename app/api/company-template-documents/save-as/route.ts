import {requireDocumentApi} from "@/lib/document-library/access";
import {readExplorer} from "@/lib/document-library/explorer-repository";
import {parseDocumentSelection} from "@/lib/document-library/selection";
import {documentFailure} from "@/lib/company-templates/documents/api";
/** 另存为只列出当前可管理位置的直属条目，列表、搜索和数量仍按当前授权过滤。 */
export async function GET(request:Request){try{
 const {supabase}=await requireDocumentApi();const params=new URL(request.url).searchParams;
 // 浏览接口要求目录和档案匹配；从当前账号可见的记录推导档案，不能沿用本人的默认档案或相信浏览器身份。
 const {data:folder,error:folderError}=await supabase.from("document_folders").select("archive_id").eq("id",params.get("folder")).maybeSingle();
 if(folderError||!folder)throw new Error("document_forbidden");
 const {data:archive,error:archiveError}=await supabase.from("document_archives").select("user_id,customer_id").eq("id",folder.archive_id).maybeSingle();
 if(archiveError||!archive)throw new Error("document_forbidden");
 params.delete("user");params.delete("customer");if(archive.user_id)params.set("user",archive.user_id);if(archive.customer_id)params.set("customer",archive.customer_id);params.set("scope","folder");
 const data=await readExplorer(supabase,parseDocumentSelection(params));if(!data.folderId||!data.canManage)throw new Error("document_forbidden");
 return Response.json({items:data.items,total:data.total,page:data.page},{headers:{"Cache-Control":"private, no-store"}});
 }catch(cause){return documentFailure(cause);}}
