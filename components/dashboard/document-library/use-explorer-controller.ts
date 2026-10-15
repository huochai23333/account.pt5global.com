"use client";
import {useState,type KeyboardEvent,type DragEvent} from "react";
import {useRouter,useParams} from "next/navigation";
import type {ExplorerLibrary,DocumentSelection,ExplorerItem,ExplorerTarget,DocumentFolder} from "@/lib/document-library/model";
import {templateDocumentHref} from "@/lib/company-templates/documents/navigation";
import {useTranslations} from "next-intl";
import {useInlineNaming} from "./use-inline-naming";
import {useDocumentExplorer} from "./use-document-explorer";
import {useExplorerSelection} from "./use-explorer-selection";
import {useExplorerOperations} from "./use-explorer-operations";
import {explorerTarget,itemManageable,folderSubject} from "./explorer-helpers";
import type {ExplorerAction} from "./explorer-toolbar";
import type {ExplorerDialogTarget,ExplorerDialogSubmission} from "./explorer-dialog";
/** 控制器调度独立的数据、选择和操作模块；页面不再承载表单或写入细节。 */
export function useExplorerController(initial:ExplorerLibrary|null,initialSelection:DocumentSelection,userId:string){
 const library=useDocumentExplorer(initial,initialSelection);const selection=useExplorerSelection(library.data?.items??[],JSON.stringify(library.selection),userId);const operations=useExplorerOperations(userId,library.data,library.refresh);
 const [view,setView]=useState<"list"|"grid">("list");const [dialog,setDialog]=useState<ExplorerDialogTarget|null>(null);const [dragging,setDragging]=useState(false);const router=useRouter();const {workspace}=useParams<{workspace:string}>();const t=useTranslations("Documents");
 const inline=useInlineNaming(async(folderId,operationId)=>{
  if(operations.single.outstanding.some(intent=>intent.action==="create_default_folder"&&intent.payload.folderId===folderId))throw new Error("unconfirmed");
  return operations.single.write("create_default_folder",{folderId,name:t("explorer.defaultFolder")},operationId);
 },async(item,name,operationId)=>operations.submit({action:"rename",items:[],item},{name,destinationId:"",manifest:null,operationId}),library.refresh);
 const busy=operations.busy||library.loading||inline.saving;
 function navigate(next:DocumentSelection){if(inline.editing)return;selection.clear();void library.navigate(next);}
 function open(item:ExplorerItem){
  if(busy)return;
  if(item.kind==="location"||item.kind==="archive")navigate(item.selection);
  else if(item.kind==="folder"&&library.data)navigate({...folderSubject(library.data,item.folder.archive_id),scope:"folder",folder:item.id});
  else if(item.kind==="template")router.push(templateDocumentHref(workspace,item.id));
  else if(item.kind==="file"){
   if(item.file.mime_type.startsWith("image/")||item.file.mime_type==="application/pdf")setDialog({action:"preview",items:[],item});
   else{const link=document.createElement("a");link.href=`/api/document-library/files/${item.id}/content`;link.click();}
  }
 }
 function move(items:ExplorerTarget[],folder:DocumentFolder){if(!busy&&folder.can_manage)setDialog({action:"move",items,destinationId:folder.id});}
 function action(name:ExplorerAction,items=selection.selected,contextFolder?:DocumentFolder){
  if(busy||inline.editing)return;const targets=items.map(explorerTarget).filter((item):item is ExplorerTarget=>item!==null);
  if(name==="refresh"){void library.refresh();return;}
  if(name==="newDocument"){const folder=contextFolder?.id??(library.data?.canManage?library.data.folderId:null);router.push(`/${workspace}/company-templates${folder?`?folder=${encodeURIComponent(folder)}`:""}`);return;}
  if(name==="open"){if(items.length===1)open(items[0]);return;}
  if(name==="create"){const destination=contextFolder??library.data?.folders.find(f=>f.id===library.data?.folderId);if(library.data?.canManage&&destination?.can_manage){if(destination.id===library.data.folderId)void inline.create(destination.id);else void library.navigate({...folderSubject(library.data,destination.archive_id),scope:"folder",folder:destination.id}).then(ok=>{if(ok)void inline.create(destination.id);});}return;}
  if(name==="paste"){if(!library.data?.canManage)return;const destination=contextFolder??library.data?.folders.find(folder=>folder.id===library.data?.folderId);if(destination?.can_manage&&selection.cut.length)setDialog({action:selection.clipboardMode==="copy"?"copy":"move",items:selection.cut,destinationId:destination.id});return;}
  if(!targets.length||targets.length!==items.length)return;
  if(name==="download"){setDialog({action:name,items:targets,item:items.length===1?items[0]:undefined});return;}
  if(!items.every(itemManageable))return;
  if(name==="rename"){
   if(items.length===1){const item=items[0];
    // 目录树可以指向别处；先进入其父目录，再在真实位置编辑，不能把别处的目录插进当前列表。
    if(contextFolder&&item.kind==="folder"&&item.folder.parent_id&&item.folder.parent_id!==library.data?.folderId&&library.data)
     void library.navigate({...folderSubject(library.data,item.folder.archive_id),scope:"folder",folder:item.folder.parent_id}).then(ok=>{if(ok)inline.start(item);});
    else inline.start(item);
   }return;
  }
  if(name==="cut"){selection.setCut(targets);return;}
  if(name==="copy"){selection.setClipboard("copy",targets);return;}
  if(name==="duplicate"&&items.length!==1)return;
  if(name==="move"||name==="delete"||name==="duplicate")setDialog({action:name==="duplicate"?"copy":name,items:targets,item:items.length===1?items[0]:undefined});
 }
 function keyboard(event:KeyboardEvent<HTMLElement>){
  if(busy||dialog||inline.editing||(event.target as HTMLElement).closest('input,textarea,select,button,[contenteditable="true"],[role="combobox"],[role="menu"]'))return;
  const ctrl=event.ctrlKey||event.metaKey;let handled=true;
  if(ctrl&&event.shiftKey&&event.key.toLowerCase()==="n")action("create");else if(ctrl&&event.key.toLowerCase()==="a")selection.selectAll();else if(ctrl&&event.key.toLowerCase()==="c")action("copy");else if(ctrl&&event.key.toLowerCase()==="x")action("cut");else if(ctrl&&event.key.toLowerCase()==="v")action("paste");else if(event.key==="Enter")action("open");else if(event.key==="F2")action("rename");else if(event.key==="Delete")action("delete");else if(event.key==="Escape")selection.clear();else handled=false;
  if(handled)event.preventDefault();
 }
 async function reconcile(receipt:{operationId:string}){if(await operations.single.reconcile(receipt))inline.recovered(receipt.operationId);}
 function dragOver(event:DragEvent){if(library.data?.canManage&&!busy&&event.dataTransfer.types.includes("Files")){event.preventDefault();setDragging(true);}}
 function drop(event:DragEvent){setDragging(false);if(library.data?.canManage&&!busy&&event.dataTransfer.files.length){event.preventDefault();void operations.single.upload(library.data.folderId!,Array.from(event.dataTransfer.files));}}
 async function submit(value:ExplorerDialogSubmission){if(!dialog)return false;const done=await operations.submit(dialog,value);if(done&&["move","delete","copy"].includes(dialog.action)){selection.clear();if(dialog.action==="move")selection.setCut([]);}return done;}
 return {library,selection,operations,inline,reconcile,view,setView,dialog,setDialog,busy,navigate,open,move,action,keyboard,dragOver,drop,dragging,setDragging,submit};
}
