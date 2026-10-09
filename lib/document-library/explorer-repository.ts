import "server-only";
import type {SupabaseClient} from "@supabase/supabase-js";
import type {DocumentSelection,ExplorerLibrary,DocumentManifest,ExplorerTarget} from "./model";
/** 分类、目录、搜索和分页在数据库先做权限过滤，不从浏览器传来的角色推算范围。 */
export async function readExplorer(db:SupabaseClient,selection:DocumentSelection):Promise<ExplorerLibrary>{
  const {data,error}=await db.rpc("document_explorer_read",{p_selection:selection});
  if(error)throw error;
  if(!data?.scope||!Array.isArray(data.items))throw new Error("unconfirmed");
  return data;
}
export async function readManifest(db:SupabaseClient,items:ExplorerTarget[],write=true):Promise<DocumentManifest>{
  const {data,error}=await db.rpc("document_explorer_manifest",{p_items:items,p_write:write});
  if(error)throw error;
  if(!data?.digest||!Array.isArray(data.entries))throw new Error("unconfirmed");
  return data;
}
