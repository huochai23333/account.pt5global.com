import type {ManifestEntry} from "./model";
/** 按目录编号分配压缩包路径。同名目录来自不同档案时各保留一份，不能合成一个目录。 */
export function archivePaths(entries:ManifestEntry[]){
 const paths=new Map<string,string>();const folders=new Map<string,string>();const used=new Set<string>();
 const safe=(name:string)=>name.replace(/[/\\\u0000-\u001f]/g,"_").replace(/^\.+$/,"_");
 function allocate(parent:string,name:string,folder:boolean){
  const base=safe(name);let candidate=base;let suffix=1;
  // Windows 解压时通常不区分大小写；文件和目录也不能占用同一个名字。
  const key=(value:string)=>(parent+value).normalize("NFC").toLowerCase();
  while(used.has(key(candidate))){suffix++;const dot=folder?-1:base.lastIndexOf(".");candidate=dot>0?base.slice(0,dot)+" ("+suffix+")"+base.slice(dot):base+" ("+suffix+")";}
  used.add(key(candidate));return parent+candidate+(folder?"/":"");
 }
 // 先父后子，使每个后代都使用父目录已经分配的路径，而不是仅比较显示名称。
 for(const entry of entries.filter(e=>e.kind==="folder").sort((a,b)=>a.path.length-b.path.length||a.id.localeCompare(b.id))){
  const parent=folders.get(String(entry.record.parent_id))??"";const path=allocate(parent,entry.record.name,true);folders.set(entry.id,path);paths.set(entry.id,path);
 }
 for(const entry of entries.filter(e=>e.kind==="file"))paths.set(entry.id,allocate(folders.get(entry.folderId)??"",entry.record.name,false));
 return paths;
}
