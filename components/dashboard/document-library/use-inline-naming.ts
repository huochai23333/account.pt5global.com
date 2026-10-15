"use client";
import {useRef,useState} from "react";
import type {DocumentFolder,DocumentReceipt,ExplorerItem} from "@/lib/document-library/model";
export type InlineEdit={item:ExplorerItem;name:string;error:string;uncertain:boolean};
type RenameIntent={operationId:string;name:string};
/** 名称编辑独立管理；创建已持久化后才允许改名，取消编辑不会删除新文件夹。 */
export function useInlineNaming(createFolder:(folderId:string,operationId:string)=>Promise<DocumentReceipt>,rename:(item:ExplorerItem,name:string,operationId:string)=>Promise<unknown>,refresh:()=>Promise<boolean>){
 const [editing,setEditing]=useState<InlineEdit|null>(null);const [saving,setSaving]=useState(false);
 const lock=useRef(false);const pending=useRef<RenameIntent|null>(null);
 function start(item:ExplorerItem){if(lock.current)return;pending.current=null;setEditing({item,name:item.name,error:"",uncertain:false});}
 async function create(folderId:string){
  if(lock.current||editing)return;lock.current=true;setSaving(true);
  try{const receipt=await createFolder(folderId,crypto.randomUUID());const folder={...receipt.record,can_manage:true} as DocumentFolder;
   pending.current=null;setEditing({item:{kind:"folder",id:folder.id,name:folder.name,folder,path:[],canManage:true},name:folder.name,error:"",uncertain:false});
  }catch{/* 写入模块保留待核对意图和面向用户的失败提示。 */}finally{lock.current=false;setSaving(false);}
 }
 function change(name:string){if(editing&&!editing.uncertain)setEditing({...editing,name,error:""});}
 // 只有同一改名操作核对成功后才能退出未知状态，避免恢复后仍锁住编辑器。
 function recovered(operationId:string){if(pending.current?.operationId===operationId){pending.current=null;setEditing(null);}}
 function cancel(){if(!lock.current){pending.current=null;setEditing(null);}}
 async function submit(edit:InlineEdit,intent:RenameIntent){
  if(lock.current)return;lock.current=true;setSaving(true);pending.current=intent;
  try{await rename(edit.item,intent.name,intent.operationId);pending.current=null;setEditing(null);await refresh();}
  catch(cause){
   // 上传文件和模板使用不同的错误前缀，统一成名称编辑可恢复的错误，不能把重名误判为断线。
   const raw=cause instanceof Error?cause.message:"unconfirmed";const key=raw.replace(/^document_/,"");const error=key==="name_conflict"?"folderNameConflict":key;
   const uncertain=!["invalid","folderNameConflict","conflict","forbidden","busy","defaultFolder"].includes(error);
   if(!uncertain)pending.current=null;setEditing({...edit,error,uncertain});
  }finally{lock.current=false;setSaving(false);}
 }
 async function commit(){
  if(!editing||editing.uncertain||lock.current)return;
  const name=editing.name.trim();
  // 空名称保留原名称；模板名称上限由模板保存契约决定，普通文件和目录最多 200 字。
  if(!name||name===editing.item.name){cancel();return;}
  const limit="document" in editing.item?120:200;
  if(name.length>limit||/[\/\\\x00-\x1f]/.test(name)){setEditing({...editing,error:"invalid"});return;}
  await submit(editing,pending.current??{operationId:crypto.randomUUID(),name});
 }
 async function retry(){
  // 核对时固定使用原名称和原操作编号；服务端返回原结果，不生成另一个改名意图。
  if(editing?.uncertain&&pending.current)await submit(editing,pending.current);
 }
 return {editing,saving,start,create,change,cancel,commit,recovered,retry};
}
export type InlineNaming=ReturnType<typeof useInlineNaming>;
