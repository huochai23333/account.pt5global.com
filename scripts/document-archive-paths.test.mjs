import test from "node:test";
import assert from "node:assert/strict";
import {archivePaths} from "../lib/document-library/archive-paths.ts";
import {archiveBytes} from "../lib/document-library/archive-bytes.ts";
import {unzipSync} from "fflate";
// 纯路径断言不连接账号；真实 ZIP 字节另由页面下载验收。
const folder=(id,name,parent=null,path=[name])=>({kind:"folder",id,path,record:{name,parent_id:parent}});
const file=(id,name,parent)=>({kind:"file",id,folderId:parent,path:[name],record:{name}});
test("不同档案同名目录独立分配，每个后代沿用自己的父目录",()=>{
 const paths=archivePaths([folder("a","合同"),folder("b","合同"),folder("c","子目录","b",["合同","子目录"]),file("x","资料.txt","a"),file("y","资料.txt","c")]);
 assert.equal(paths.get("a"),"合同/");assert.equal(paths.get("b"),"合同 (2)/");assert.equal(paths.get("c"),"合同 (2)/子目录/");assert.equal(paths.get("x"),"合同/资料.txt");assert.equal(paths.get("y"),"合同 (2)/子目录/资料.txt");
});
test("同名上传和大小写相同路径不覆盖，后缀保留扩展名",()=>{
 const paths=archivePaths([folder("a","合同"),file("x","资料.TXT","a"),file("y","资料.txt","a"),file("z","资料.txt","a")]);
 assert.equal(paths.get("x"),"合同/资料.TXT");assert.equal(paths.get("y"),"合同/资料 (2).txt");assert.equal(paths.get("z"),"合同/资料 (3).txt");
});
test("名字清理后碰撞及文件目录同名仍分别保留",()=>{
 const paths=archivePaths([folder("a","same/name"),folder("b","same\\name"),file("x","same_name",null),file("y",".",null)]);
 assert.equal(paths.get("a"),"same_name/");assert.equal(paths.get("b"),"same_name (2)/");assert.equal(paths.get("x"),"same_name (3)");assert.equal(paths.get("y"),"_");
});
test("特殊属性名与空目录真实写入 ZIP，正文没有漏项",()=>{
 const input=new Map([["__proto__",new Uint8Array([65,66])],["constructor",new Uint8Array([67])],["空目录/",new Uint8Array()]]);const names=[];
 const result=unzipSync(archiveBytes(input),{filter:entry=>{names.push(entry.name);return true;}});
 assert.deepEqual(names,["__proto__","constructor","空目录/"]);assert.deepEqual(result["__proto__"],input.get("__proto__"));assert.deepEqual(result["constructor"],input.get("constructor"));assert.deepEqual(result["空目录/"],new Uint8Array());
});
