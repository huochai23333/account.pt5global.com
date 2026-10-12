import type {NextRequest} from "next/server";
import {documentAccess,documentFailure} from "@/lib/company-templates/documents/api";
import {readDraft} from "@/lib/company-templates/documents/draft-repository";
import {readDocumentHtml} from "@/lib/company-templates/documents/repository";
import {documentBridge} from "@/lib/company-templates/documents/frame-bridge";
import {getRequestPublicOrigin} from "@/lib/public-site-origin";
import {TEMPLATE_CONTENT_SECURITY_POLICY} from "@/lib/company-templates/content-security";
/** 先检查草稿创建者，再读取固定版本正文；只接收当前窗口的沙箱握手。 */
export async function GET(request:NextRequest,{params}:{params:Promise<{draftId:string}>}){
 try{const db=await documentAccess();const draft=await readDraft(db,(await params).draftId);if(!draft)throw new Error("document_missing");const token=new URL(request.url).searchParams.get("loadToken")??"";if(!/^[a-f0-9-]{36}$/i.test(token))throw new Error("document_invalid");
  return new Response(documentBridge(await readDocumentHtml(db,draft),token,getRequestPublicOrigin(request)),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store","Content-Security-Policy":TEMPLATE_CONTENT_SECURITY_POLICY,"Referrer-Policy":"no-referrer","X-Content-Type-Options":"nosniff"}});
 }catch(cause){return documentFailure(cause);}
}
export function HEAD(){return new Response(null,{status:405,headers:{Allow:"GET"}});}
