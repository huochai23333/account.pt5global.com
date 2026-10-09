import type {ExplorerItem,ExplorerTarget,DocumentFolder,DocumentSelection,ExplorerLibrary} from "@/lib/document-library/model";
export function explorerTarget(item:ExplorerItem):ExplorerTarget|null {
 if(item.kind==="file")return {kind:item.kind,id:item.id,version:item.file.version};
 if(item.kind==="template")return {kind:item.kind,id:item.id,version:item.document.revision};
 if(item.kind==="folder")return {kind:item.kind,id:item.id,version:item.folder.version};
 return null;
}
export function folderSubject(data:ExplorerLibrary,archiveId=data.archiveId):DocumentSelection {
 const archive=data.archives.find(a=>a.id===archiveId);
 return archive?.customer_id?{customer:archive.customer_id}:{user:archive?.user_id??undefined};
}
/** 路径只使用服务器返回的可见目录，隐藏区域不能在浏览器补全。 */
export function folderPath(id:string,folders:DocumentFolder[],label:(f:DocumentFolder)=>string){
 const path:DocumentFolder[]=[];const visited=new Set<string>();let current=folders.find(f=>f.id===id);
 while(current&&!visited.has(current.id)){visited.add(current.id);path.unshift(current);current=folders.find(f=>f.id===current?.parent_id);}
 return path.map(label).join(" / ");
}
export function itemManageable(item:ExplorerItem){return "canManage" in item&&item.canManage&&(item.kind!=="folder"||!item.folder.system_key);}
export function itemDate(item:ExplorerItem){return item.kind==="file"?(item.file.updated_at??item.file.created_at):item.kind==="template"?item.document.updated_at:item.kind==="folder"?item.folder.created_at:undefined;}
