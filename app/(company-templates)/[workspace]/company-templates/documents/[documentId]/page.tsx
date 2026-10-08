import {notFound} from "next/navigation";
import {requireCompanyTemplateWorkspace} from "@/lib/company-templates/access";
import {getServerSupabaseClient} from "@/lib/supabase-server";
import {readTemplateDocument,hasDocumentGuide} from "@/lib/company-templates/documents/repository";
import {DocumentEditor} from "@/components/dashboard/company-templates/documents/document-editor";
/** 权限检查后读取本人数据；他人的编号与不存在的编号都显示同样的未找到页面。 */
export default async function TemplateDocumentPage({params}:{params:Promise<{workspace:string;documentId:string}>}){
  const {workspace,documentId}=await params;await requireCompanyTemplateWorkspace(workspace);
  const db=await getServerSupabaseClient();const document=await readTemplateDocument(db,documentId);if(!document)notFound();
  return <DocumentEditor key={`${document.id}:${document.revision}`} document={document} workspace={workspace} hasGuide={await hasDocumentGuide(db,document)}/>;
}
