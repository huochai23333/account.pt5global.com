import type {DocumentLocation} from "./model";
/** 链接始终使用本站相对路径，部署域名由浏览器决定，不嵌入本地开发地址。 */
export function documentLibraryHref(workspace: string, location: DocumentLocation) {
  const query = new URLSearchParams({folder: location.folder_id});
  if (location.customer_id) query.set("customer", location.customer_id);
  else if (location.user_id) query.set("user", location.user_id);
  return `/${workspace}/documents?${query}`;
}
export function templateDocumentHref(workspace: string, id: string) {
  return `/${workspace}/documents/templates/${id}`;
}
