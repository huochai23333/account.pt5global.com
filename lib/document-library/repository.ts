import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentLibrary, DocumentSelection } from "./model";

export async function readDocumentLibrary(supabase: SupabaseClient, selection: DocumentSelection): Promise<DocumentLibrary> {
  const { data, error } = await supabase.rpc("document_library_read", {
    p_user: selection.user || null, p_customer: selection.customer || null, p_folder: selection.folder || null,
    p_query: selection.query || "", p_page: selection.page || 1,
  });
  if (error) throw error;
  if (!data?.archiveId || !Array.isArray(data.folders) || !Array.isArray(data.files) || !Array.isArray(data.items)) throw new Error("unconfirmed");
  return data as DocumentLibrary;
}
