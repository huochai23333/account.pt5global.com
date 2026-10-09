import {requireDocumentApi} from "@/lib/document-library/access";
import {checkDocumentOrigin,documentError,readDocumentBody} from "@/lib/document-library/http";
import {continueBatch,readBatch} from "@/lib/document-library/batches";
export async function GET(request:Request){try{
 const {supabase}=await requireDocumentApi();return Response.json(await readBatch(supabase,new URL(request.url).searchParams.get("id")??""),{headers:{"Cache-Control":"private, no-store"}});
}catch(error){return documentError(error);}}
/** 准备、续办和解除保护都使用原批次编号；不以请求成功代替每一项的业务终态。 */
export async function POST(request:Request){try{
 const {supabase,userId}=await requireDocumentApi();checkDocumentOrigin(request);
 const body=JSON.parse((await readDocumentBody(request,65536)).toString("utf8"));
 if(body.release){const result=await supabase.rpc("document_batch_release",{p_id:body.id});if(result.error)throw result.error;return Response.json(await readBatch(supabase,body.id));}
 if(body.request){const result=await supabase.rpc("document_batch_start",{p_id:body.id,p_request:body.request,p_digest:body.digest});if(result.error)throw result.error;}
 return Response.json(await continueBatch(supabase,userId,body.id),{headers:{"Cache-Control":"private, no-store"}});
}catch(error){return documentError(error);}}
