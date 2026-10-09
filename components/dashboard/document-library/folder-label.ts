import type {DocumentFolder} from "@/lib/document-library/model";
/** 系统区域显示日常语言；自建文件夹使用用户填写的名称。 */
export function folderLabel(folder:DocumentFolder,t:(key:string)=>string){return folder.system_key?t(`zones.${folder.zone}`):folder.name;}
