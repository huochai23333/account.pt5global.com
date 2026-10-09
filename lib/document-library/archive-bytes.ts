import {Zip,ZipPassThrough} from "fflate";
/** 每条路径直接写入 ZIP，避免压缩库的对象展开把特殊文件名当作原型属性而漏项。 */
export function archiveBytes(entries:ReadonlyMap<string,Uint8Array>){
 const chunks:Uint8Array[]=[];let failure:Error|null=null;let complete=false;
 const archive=new Zip((error,bytes,final)=>{if(error){failure=error;return;}chunks.push(bytes);if(final)complete=true;});
 for(const [path,bytes] of entries){const file=new ZipPassThrough(path);archive.add(file);file.push(bytes,true);}
 archive.end();if(failure)throw failure;if(!complete)throw new Error("unconfirmed");
 const result=new Uint8Array(chunks.reduce((size,chunk)=>size+chunk.length,0));let offset=0;
 for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result;
}
