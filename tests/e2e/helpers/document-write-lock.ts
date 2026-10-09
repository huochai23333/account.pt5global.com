import {spawn} from "node:child_process";
import {readLocalEnvValue} from "./local-supabase-admin";
/** 在本地持有真实目录事务锁，使服务端等待；关闭连接自动释放，不把浏览器拦截器当成网络超时。 */
export async function holdDocumentWrites(){
 if(!/^http:\/\/(127\.0\.0\.1|localhost):54321$/.test(readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL")??""))throw new Error("local_docker_required");
 const process=spawn("docker",["exec","-i","supabase_db_pt5-dropshipping","psql","-U","postgres","-d","postgres","-qAt"],{stdio:["pipe","pipe","pipe"]});
 await new Promise<void>((resolve,reject)=>{
  const timeout=setTimeout(()=>{process.stdin.end();reject(new Error("local_lock_timeout"));},10000);
  process.once("error",error=>{clearTimeout(timeout);reject(error);});
  process.stdout.on("data",data=>{if(String(data).includes("document-test-ready")){clearTimeout(timeout);resolve();}});
  process.stdin.write("select pg_advisory_lock(hashtextextended('document-explorer-tree',0));select 'document-test-ready';\n");
 });
 return async()=>{const closed=new Promise<void>(resolve=>process.once("close",()=>resolve()));process.stdin.end();await closed;};
}
