import type {DocumentSelection} from "./model";
/** URL 只描述浏览位置；有效编号与授权仍由数据库检查。 */
export function parseDocumentSelection(params: URLSearchParams): DocumentSelection {
  const scope=params.get("scope") as DocumentSelection["scope"];
  return {scope:scope??undefined,user:params.get("user")??undefined,customer:params.get("customer")??undefined,folder:params.get("folder")??undefined,query:params.get("query")??undefined,page:Number(params.get("page"))||1,sort:(params.get("sort")??"name") as DocumentSelection["sort"],direction:(params.get("direction")??"asc") as DocumentSelection["direction"]};
}
export function documentQuery(selection: DocumentSelection) {
  const params=new URLSearchParams();
  Object.entries(selection).forEach(([key,value])=>{if(value)params.set(key,String(value));});
  return params;
}
