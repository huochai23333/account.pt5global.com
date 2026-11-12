import {execFileSync} from "node:child_process";
import {readDisposablePostgresTarget} from "./disposable-fixture.ts";
import {buildLogisticsFixturePrepareSql,buildLogisticsFixturePreparedReadSql,buildLogisticsFixtureRestoreSql,buildLogisticsFixtureRestoredReadSql} from "./logistics-fixture-sql.ts";

export type LogisticsFixtureRunner=(args: string[],input?: string)=>string;
/** 错误可能带配置行DETAIL；只保留白名单错误编号，不把旧配置或密钥带入页面测试日志。 */
export const runLogisticsFixtureCommand: LogisticsFixtureRunner=(args,input)=>{
  try{return execFileSync("docker",args,{input,encoding:"utf8",timeout:15000,maxBuffer:8*1024*1024,stdio:["pipe","pipe","pipe"]}).trim();}
  catch(error){
    const stderr=String((error as {stderr?: unknown}).stderr??"");
    const code=/^ERROR:\s+(logistics_fixture_[a-z_]+)\s*$/m.exec(stderr)?.[1];
    throw new Error(code??"logistics_fixture_command_failed");
  }
};
const fingerprint=(value: unknown): value is string=>typeof value==="string"&&/^[a-f0-9]{32}$/.test(value);

/** 一次夹具固定同一声明与目标；每次写入及独立读回前仍重新核验真实项目/网关/暂停状态。 */
export function createLogisticsFixtureStore(run: LogisticsFixtureRunner=runLogisticsFixtureCommand){
  const boundary={baseURL:process.env.PLAYWRIGHT_BASE_URL,supabaseURL:process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode:process.env.PT5_E2E_FIXTURE_MODE,project:process.env.PT5_E2E_DATABASE_PROJECT,container:process.env.PT5_E2E_DATABASE_CONTAINER};
  const container=readDisposablePostgresTarget(boundary,args=>run(args));
  const verifySource=()=>{
    try{
      // Docker只在内存返回环境；不打印整份配置，也不输出任何令牌的实际值。
      const edge=JSON.parse(run(["inspect","--format",'{"id":{{json .Id}},"labels":{{json .Config.Labels}},"running":{{json .State.Running}},"env":{{json .Config.Env}},"networks":{{json .NetworkSettings.Networks}}}',`supabase_edge_runtime_${boundary.project}`]));
      if(edge.running!==true||edge.labels?.["com.supabase.cli.project"]!==boundary.project
        ||!Array.isArray(edge.env)||!edge.env.includes("LOGISTICS_SOURCE_ARCHIVE_API_URL=http://host.docker.internal:43194/source")
        ||!edge.env.includes("LOGISTICS_SOURCE_ARCHIVE_API_TOKEN=local-fixture"))throw new Error("unconfirmed");
      const database=JSON.parse(run(["inspect","--format",'{"networks":{{json .NetworkSettings.Networks}}}',container]));
      const databaseNetworks=new Set(Object.values(database.networks??{}).map(value=>(value as {NetworkID?: string}).NetworkID).filter(Boolean));
      if(!Object.values(edge.networks??{}).some(value=>databaseNetworks.has((value as {NetworkID?: string}).NetworkID)))throw new Error("unconfirmed");
    }catch{throw new Error("logistics_fixture_edge_mock_unconfirmed");}
  };
  verifySource();
  const verify=()=>{
    if(readDisposablePostgresTarget(boundary,args=>run(args))!==container)throw new Error("logistics_fixture_target_changed");
    verifySource();
  };
  const execute=(input: string)=>{
    verify();return run(["exec","-i","-e","PGOPTIONS=-c statement_timeout=12000 -c lock_timeout=10000",container,
      "psql","-U","postgres","-d","postgres","-X","-qAt","-v","ON_ERROR_STOP=1"],input);
  };
  let originalFingerprint: string|undefined;
  return {apiUrl:new URL(boundary.supabaseURL!).origin,execute,
    readRows<Row>(query: string): Row[]{
      const value=JSON.parse(execute(`select coalesce(json_agg(records),'[]') from (${query})records;`));
      if(!Array.isArray(value))throw new Error("logistics_fixture_rows_missing");return value as Row[];
    },
    prepare(token: string){
      const receipt=JSON.parse(execute(buildLogisticsFixturePrepareSql(token)));
      if(receipt?.prepared!==true||!fingerprint(receipt.fingerprint))throw new Error("logistics_fixture_prepare_receipt_invalid");
      originalFingerprint=receipt.fingerprint;
      const actual=JSON.parse(execute(buildLogisticsFixturePreparedReadSql()));
      if(actual?.state!==1||actual.checkpoints!==0||actual.secret!==1)throw new Error("logistics_fixture_prepare_readback_failed");
      return receipt;
    },
    restore(token: string,ids: string[]){
      const receipt=JSON.parse(execute(buildLogisticsFixtureRestoreSql(token,ids)));
      if(receipt?.restored===true){
        if(!fingerprint(receipt.fingerprint)||(originalFingerprint&&receipt.fingerprint!==originalFingerprint)
          ||!Number.isSafeInteger(receipt.records)||receipt.records<0||receipt.records>50
          ||![0,1].includes(receipt.observations)||receipt.operations!==ids.length)
          throw new Error("logistics_fixture_restore_receipt_invalid");
        originalFingerprint??=receipt.fingerprint;
      }else if(receipt?.restored!==false||receipt.notPrepared!==true)throw new Error("logistics_fixture_restore_receipt_invalid");
      const actual=JSON.parse(execute(buildLogisticsFixtureRestoredReadSql(ids)));
      if(!fingerprint(actual?.fingerprint)||actual.backup!==false||actual.records!==0||actual.observations!==0||actual.operations!==0
        ||(originalFingerprint&&actual.fingerprint!==originalFingerprint))throw new Error("logistics_fixture_restore_readback_failed");
      return receipt;
    }};
}
