import {requireDocumentApi} from "@/lib/document-library/access";
import {checkDocumentOrigin,documentError,readDocumentBody} from "@/lib/document-library/http";
import {downloadArchive} from "@/lib/document-library/download-archive";
export async function POST(request:Request){try{
 const {supabase}=await requireDocumentApi();checkDocumentOrigin(request);
 const body=JSON.parse((await readDocumentBody(request,65536)).toString("utf8"));
 const bytes=await downloadArchive(supabase,body.items);
 return new Response(bytes,{headers:{"Content-Type":"application/zip","Content-Disposition":"attachment; filename=PT5-documents.zip","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
}catch(error){return documentError(error);}}
