import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import * as sql from "../../tests/test-support/settlement-fixture-cleanup-sql.ts";
import { readDisposablePostgresTarget } from "../../tests/test-support/disposable-fixture.ts";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";

const release="bb000000-0000-4000-8000-000000000001";
const receipt={releaseIds:[release],allocationIds:[],settlementIds:[],deleted:{releases:1,allocations:0,settlements:0}};
/** 只注入Docker进程边界，执行实际准入/传输模块；不读取原账号或管理员入口。 */
function fixture(change={}) {
  const project="pt5-e2e-settlement-fixture", calls=[];
  const env={PLAYWRIGHT_BASE_URL:"http://localhost:3000",NEXT_PUBLIC_SUPABASE_URL:"http://127.0.0.1:48111",
    PT5_E2E_FIXTURE_MODE:"disposable",PT5_E2E_DATABASE_PROJECT:project,PT5_E2E_DATABASE_CONTAINER:`supabase_db_${project}`,...change.env};
  const execute=(command,args,options)=>{
    assert.equal(command,"docker");calls.push({args,options});
    if(args[0]==="inspect")return JSON.stringify({running:true,labels:{"com.supabase.cli.project":project},
      ports:{"8000/tcp":[{HostIp:"127.0.0.1",HostPort:change.port??"48111"}]},networks:{own:{NetworkID:"fixture-net"}}});
    if(!options?.input)return change.idle??"off|0|0";
    assert.equal(options.timeout,15000);assert.equal(options.maxBuffer,16*1024*1024);
    assert(args.includes(`supabase_db_${project}`));assert(args.includes("-i"));
    if(options.input.startsWith("\\set")){
      if(change.writeError)throw change.writeError;
      return JSON.stringify(change.receipt??receipt);
    }
    if(change.readError)throw change.readError;
    return JSON.stringify(change.remaining??{releases:0,allocations:0,settlements:0});
  };
  const require=name=>{
    if(name==="node:child_process")return {execFileSync:execute};
    if(name==="./disposable-fixture")return {readDisposablePostgresTarget};
    if(name==="./settlement-fixture-cleanup-sql")return sql;
    throw new Error("unexpected_settlement_fixture_import:"+name);
  };
  const source=fs.readFileSync(new URL("../../tests/test-support/settlement-fixture-cleanup.ts",import.meta.url),"utf8");
  const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};vm.runInNewContext(compiled,{require,exports,process:{env},URL});
  return {calls,clean:exports.cleanupLocalSettlementFixtures};
}

test("备注只按精确值去重，拒绝空值、控制字符和过大集合",()=>{
  assert.deepEqual(sql.settlementFixtureNotes(["本次备注","本次备注"]),["本次备注"]);
  for(const notes of [[""],["\n"],["x\0y"],["x".repeat(257)],Array(101).fill("note"),[null]])assert.throws(()=>sql.settlementFixtureNotes(notes),/notes_invalid/);
});
test("空集合不接触Docker或数据库",()=>{const f=fixture();assert.equal(f.clean([]),undefined);assert.equal(f.calls.length,0);});
test("SQL备注位于DO外，分隔符与引号不会变成函数源码",()=>{
  const input=sql.buildSettlementFixtureCleanupSql(["quote' $cleanup$ \\ exact"]);
  assert(input.includes("'quote'' $cleanup$ \\ exact'"));
  assert(input.indexOf("insert into cleanup_notes")<input.indexOf("do $cleanup$"));
  assert.equal(input.split("do $cleanup$").length,2);assert(input.includes("for update of r"));
});
test("回执拒绝缺字段、编号重复、错误影响数及非UUID",()=>{
  for(const value of [null,{}, {...receipt,releaseIds:[release,release.toUpperCase()]}, {...receipt,deleted:{...receipt.deleted,releases:0}}, {...receipt,releaseIds:["%"]}])
    assert.throws(()=>sql.validateSettlementCleanupReceipt(value),/receipt_/);
});
test("原子提交后另连读回且两次核验项目",()=>{
  const f=fixture();assert.deepEqual(JSON.parse(JSON.stringify(f.clean(["本次备注"]))),receipt);
  assert.equal(f.calls.filter(c=>c.args[0]==="inspect").length,4);
  const actual=f.calls.filter(c=>c.options?.input);assert.equal(actual.length,2);
  assert.match(actual[0].options.input,/commit;\nselect receipt/);assert.match(actual[1].options.input,/source_settlement_release_id/);
});
test("共享项目即使声明disposable也在任何Docker调用前拒绝",()=>{
  const f=fixture({env:{PT5_E2E_DATABASE_PROJECT:"pt5-dropshipping",PT5_E2E_DATABASE_CONTAINER:"supabase_db_pt5-dropshipping"}});
  assert.throws(()=>f.clean(["note"]),/dedicated_project/);assert.equal(f.calls.length,0);
});
test("缺少disposable声明时不尝试原管理连接",()=>{
  const f=fixture({env:{PT5_E2E_FIXTURE_MODE:""}});assert.throws(()=>f.clean(["note"]),/destructive E2E/);assert.equal(f.calls.length,0);
});
test("API映射不符时只读检查后拒绝，不执行清理",()=>{
  const f=fixture({port:"48112"});assert.throws(()=>f.clean(["note"]),/api_port_mismatch/);assert(!f.calls.some(c=>c.options?.input));
});
test("调度或外部队列未停时拒绝",()=>{
  for(const idle of ["on|0|0","off|1|0","off|0|1"]){const f=fixture({idle});assert.throws(()=>f.clean(["note"]),/paused_scheduler/);assert(!f.calls.some(c=>c.options?.input));}
});
test("执行或回执失败不伪造清理完成，也不继续假读回",()=>{
  const failure=new Error("commit_failed"),f=fixture({writeError:failure});assert.throws(()=>f.clean(["note"]),error=>error===failure);
  assert.equal(f.calls.filter(c=>c.options?.input).length,1);
});
test("提交后查询失败保留失败，不用原回执替代",()=>{
  const failure=new Error("readback_failed"),f=fixture({readError:failure});assert.throws(()=>f.clean(["note"]),error=>error===failure);
});
test("三类残留和未知计数均拒绝",()=>{
  for(const remaining of [{releases:1,allocations:0,settlements:0},{releases:0,allocations:1,settlements:0},{releases:0,allocations:0,settlements:1},{}]){
    const f=fixture({remaining});assert.throws(()=>f.clean(["note"]),/readback_failed/);
  }
});

/** 只编译实际合计函数，真实SDK使用明确内存HTTP边界；原认证导入不读取、不解析。 */
function allocationReader(body) {
  let calls=0;
  const admin=createClient("http://settlement-fixture.invalid","synthetic-not-a-secret",{
    auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(input)=>{
      calls++;const url=new URL(String(input));
      const data=url.pathname.endsWith("/wholesale_settlement_releases")?{id:release}:body;
      return new Response(JSON.stringify(data),{status:200,headers:{"Content-Type":"application/json"}});
    }},
  });
  const source=fs.readFileSync(new URL("../../tests/e2e/helpers/wholesale-settlement-fixtures.ts",import.meta.url),"utf8");
  const ast=ts.createSourceFile("fixture.ts",source,ts.ScriptTarget.Latest,true);
  const declaration=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==="getActiveAllocationTotal");assert(declaration);
  const compiled=ts.transpileModule('const getLocalSupabaseAdminClient=()=>globalThis.admin;\n'+declaration.getText(ast),
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const exports={};vm.runInNewContext(compiled,{exports,admin});return {read:()=>exports.getActiveAllocationTotal("note"),calls:()=>calls};
}
test("实际SDK合计保留有效金额和真正空数组，分别完成两次查询",async()=>{
  for(const [rows,expected]of [[[],0],[[{allocation_amount:"40"},{allocation_amount:60}],100]]){
    const fixture=allocationReader(rows);assert.equal(await fixture.read(),expected);assert.equal(fixture.calls(),2);
  }
});
test("实际SDK的null正文和不可能金额不能变成清空成功",async()=>{
  for(const rows of [null,{},[{allocation_amount:null}],[{allocation_amount:""}],[{allocation_amount:"wrong"}],[{allocation_amount:0}],[{allocation_amount:-1}]]){
    const fixture=allocationReader(rows);await assert.rejects(fixture.read(),/核对/);assert.equal(fixture.calls(),2);
  }
});

/** 只抽取原用例声明；在首次登录前注入生命周期故障，不加载认证、页面或业务夹具模块。 */
async function monthlyLifetime(change={}) {
  const events=[],bodyError=new Error("synthetic-body-failed"),closeError=new Error("synthetic-close-failed"),cleanupError=new Error("synthetic-cleanup-failed");
  const source=fs.readFileSync(new URL("../../tests/e2e/wholesale-settlement-monthly-summary.spec.ts",import.meta.url),"utf8");
  const ast=ts.createSourceFile("monthly.ts",source,ts.ScriptTarget.Latest,true);
  const statement=ast.statements.find(node=>ts.isExpressionStatement(node)&&ts.isCallExpression(node.expression)&&node.expression.expression.getText(ast)==="test");assert(statement);
  const compiled=ts.transpileModule(statement.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  let run,created=0;
  vm.runInNewContext(compiled,{test:(_title,callback)=>run=callback,randomUUID:()=>"synthetic-unique",getLocalSupabaseAdminClient:()=>({}),
    findMissingUsdRateDate:async()=>"2026-01-01",cleanupFixtureResources,
    cleanupSettlementReleaseFixtures:async()=>{events.push("cleanup");if(change.cleanupFails)throw cleanupError;},
    loginAs:async()=>{events.push("login");throw bodyError;}});
  const browser={newPage:async()=>{created++;events.push("page"+created);if(change.secondPageFails&&created===2)throw bodyError;
    const page=created;return {close:async()=>{events.push("close"+page);if(change.closeFails&&page===1)throw closeError;}};}};
  let failure;try{await run({browser});}catch(error){failure=error;}
  assert(failure);return {events,failure,bodyError,closeError,cleanupError};
}
test("原月度用例第二页构造失败仍关闭第一页并清理",async()=>{
  const f=await monthlyLifetime({secondPageFails:true});assert.equal(f.failure,f.bodyError);
  assert.deepEqual(f.events,["page1","page2","close1","cleanup"]);
});
test("关闭一页失败仍关闭另一页并保留原业务失败",async()=>{
  const f=await monthlyLifetime({closeFails:true});assert.equal(f.failure.message,"monthly_settlement_cleanup_failed");
  assert.equal(f.failure.errors[0],f.bodyError);assert(f.failure.errors[1].errors.includes(f.closeError));
  assert.deepEqual(f.events,["page1","page2","login","close1","close2","cleanup"]);
});
test("回收失败同时保留原业务异常和清理异常",async()=>{
  const f=await monthlyLifetime({cleanupFails:true});assert.equal(f.failure.errors[0],f.bodyError);
  assert(f.failure.errors[1].errors.includes(f.cleanupError));
});
