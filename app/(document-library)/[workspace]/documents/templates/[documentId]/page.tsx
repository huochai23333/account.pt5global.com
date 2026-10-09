import {notFound} from "next/navigation";
import {requireDocumentWorkspace} from "@/lib/document-library/access";
import {getServerSupabaseClient} from "@/lib/supabase-server";
import {readTemplateDocument,hasDocumentGuide} from "@/lib/company-templates/documents/repository";
import {DocumentEditor} from "@/components/dashboard/company-templates/documents/document-editor";
/** 权限检查后读取当前目录可见数据；不可见编号与不存在编号同样返回未找到。 */
export default async function TemplateDocumentPage({params}:{params:Promise<{workspace:string;documentId:string}>}){
  const {workspace,documentId}=await params;await requireDocumentWorkspace(workspace);
  const db=await getServerSupabaseClient();const document=await readTemplateDocument(db,documentId);if(!document)notFound();
  return <DocumentEditor key={`${document.id}:${document.revision}`} document={document} workspace={workspace} hasGuide={await hasDocumentGuide(db,document)}/>;
}
