import {expect as playwrightExpect} from '@playwright/test';
import * as learningLead from '../../PT5-dropshipping-supabase/scripts/learning-lead-fixture-sql.mjs';
import {cleanupFixtureResources} from '../tests/test-support/fixture-cleanup-sequence.ts';
import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { requireDisposableFixture, requireDisposablePostgresTarget, readDisposablePostgresTarget } from "../tests/test-support/disposable-fixture.ts";

const valid = { baseURL: "http://127.0.0.1:3000", supabaseURL: "http://localhost:54321", mode: "disposable" };
test("explicit disposable local endpoints pass the admission guard", () => {
  assert.doesNotThrow(() => requireDisposableFixture(valid));
});
for (const mode of [undefined, "", "shared", "Disposable"]) {
  test(`isolated wrong fixture mode ${JSON.stringify(mode)} rejects`, () => {
    assert.throws(() => requireDisposableFixture({ ...valid, mode }), /PT5_E2E_FIXTURE_MODE/);
  });
}
for (const field of ["baseURL", "supabaseURL"]) {
  for (const endpoint of [undefined, "http://localhost.example.test", "https://remote.example.test", "file:///localhost", "http://user:synthetic@localhost"]) {
    test(`isolated invalid ${field} ${JSON.stringify(endpoint)} rejects`, () => {
      assert.throws(() => requireDisposableFixture({ ...valid, [field]: endpoint }), /fixture endpoint/);
    });
  }
}
test("IPv6 loopback is accepted only with the explicit fixture declaration", () => {
  assert.doesNotThrow(() => requireDisposableFixture({ ...valid, baseURL: "http://[::1]:3000", supabaseURL: "http://[::1]:54321" }));
});

const project = "pt5-e2e-templates";
const dedicated = { ...valid, supabaseURL: "http://localhost:48022", project, container: `supabase_db_${project}` };
const metadata = () => ({ labels: { "com.supabase.cli.project": project }, running: true,
  ports: { "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: "48022" }] }, networks: { fixture: { NetworkID: "owned-network" } } });

test("专属数据库、网关标签和API端口/网络一致才允许取锁目标", () => {
  const inspected = [];
  assert.equal(requireDisposablePostgresTarget(dedicated, name => { inspected.push(name); return metadata(); }), dedicated.container);
  assert.deepEqual(inspected, [dedicated.container, `supabase_kong_${project}`]);
});
test("共享项目、伪造容器或缺少声明在首次Docker读取前拒绝", () => {
  for (const change of [{ project: "pt5-dropshipping", container: "supabase_db_pt5-dropshipping" }, { container: "supabase_db_other" }, { mode: undefined }, { project: undefined }]) {
    let reads = 0;
    assert.throws(() => requireDisposablePostgresTarget({ ...dedicated, ...change }, () => { reads++; return metadata(); }));
    assert.equal(reads, 0);
  }
});
test("API只接受明确的本地HTTP原点，不接受路径、凭据或模糊端口", () => {
  for (const supabaseURL of ["http://localhost", "http://localhost:48022/path", "http://localhost:48022/?secret=x", "https://localhost:48022", "http://user:synthetic@localhost:48022"]) {
    let reads = 0;
    assert.throws(() => requireDisposablePostgresTarget({ ...dedicated, supabaseURL }, () => { reads++; return metadata(); }));
    assert.equal(reads, 0);
  }
});
test("任一容器停机、错项目、错端口或不共享网络均拒绝", () => {
  for (const [name, mutate] of [
    ["database", info => { info.running = false; }],
    ["gateway", info => { info.labels["com.supabase.cli.project"] = "other-project"; }],
    ["gateway", info => { info.ports["8000/tcp"][0].HostPort = "48021"; }],
    ["gateway", info => { info.networks.fixture.NetworkID = "different-network"; }],
    ["gateway", info => { info.ports = null; }],
  ]) {
    assert.throws(() => requireDisposablePostgresTarget(dedicated, requested => {
      const info = metadata();
      if ((requested.startsWith("supabase_db_") ? "database" : "gateway") === name) mutate(info);
      return info;
    }));
  }
});

/** 执行真实SQL读/写助手，Docker数据明确由场景提供；不加载认证助手或连接数据库。 */
function independentQueryFixture({ output = '[{"count":21}]', change = {}, paused = "off|0|0", sourceFile = "local-postgres-query.ts", sqlError } = {}) {
  const env = {
    PLAYWRIGHT_BASE_URL: dedicated.baseURL,
    NEXT_PUBLIC_SUPABASE_URL: dedicated.supabaseURL,
    PT5_E2E_FIXTURE_MODE: dedicated.mode,
    PT5_E2E_DATABASE_PROJECT: dedicated.project,
    PT5_E2E_DATABASE_CONTAINER: dedicated.container,
    ...change,
  };
  const calls = [];
  const execFileSync = (command, args, options) => {
    assert.equal(command, "docker");
    assert.equal(options.timeout, 15_000);
    calls.push(args);
    if (args[0] === "inspect") return JSON.stringify(metadata());
    if (args.at(-1).startsWith("select current_setting('cron.launch_active_jobs')")) return paused;
    if (sqlError) throw sqlError;
    return output;
  };
  function load(filename) {
    const source = fs.readFileSync(new URL(`../tests/e2e/helpers/${filename}`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
    } }).outputText;
    const fixtureModule = { exports: {} };
    vm.runInNewContext(compiled, {
      module: fixtureModule, exports: fixtureModule.exports, process: { env },
      require(name) {
        // 费用助手使用默认导入断言来检查订单编号。按项目的导入语义提供这个内建模块，Docker 仍使用替身。
        if (name === "node:assert/strict") return assert;
        if (name === "node:child_process") return { execFileSync };
        if (name === "../../test-support/disposable-fixture") return { readDisposablePostgresTarget };
        if (name === "./local-supabase") return load("local-supabase.ts");
        throw new Error(`未允许的测试依赖：${name}`);
      },
    }, { timeout: 2_000 });
    return fixtureModule.exports;
  }
  const fixtureExports = load(sourceFile);
  return { query: fixtureExports.readLocalPostgresRows, quote: fixtureExports.localSqlValue,
    sql: fixtureExports.runLocalSupabaseSql ?? fixtureExports.runWholesaleFeeSql, probe: fixtureExports.isLocalSupabaseTestTarget,
    feeOrder: fixtureExports.readWholesaleFeeOrder, feeCommission: fixtureExports.readWholesaleFeeCommission,
    feeAttachmentObjects: fixtureExports.readWholesaleOrderAttachmentObjects, calls, env };
}

test("独立查询绑定已核验专属容器并保留只读事务及psql启动限制", () => {
  const fixture = independentQueryFixture();
  assert.equal(fixture.query("select count(*) from public.owned_fixture")[0].count, 21);
  const args = fixture.calls.at(-1);
  assert.equal(fixture.calls.length, 4);
  assert.equal(args[3], dedicated.container);
  assert(args.includes("-XqAtw"));
  assert(args.includes("PGOPTIONS=-c statement_timeout=12000 -c lock_timeout=10000 -c default_transaction_read_only=on"));
  assert.equal(fixture.quote("quote'$$"), "'quote''$$'");
});

test("独立查询拒绝共享项目和活跃外部队列，失败后不发数据查询", () => {
  for (const options of [
    { change: { PT5_E2E_DATABASE_PROJECT: "pt5-dropshipping", PT5_E2E_DATABASE_CONTAINER: "supabase_db_pt5-dropshipping" } },
    { paused: "off|0|1" },
  ]) {
    const fixture = independentQueryFixture(options);
    assert.throws(() => fixture.query("select 1"), /document_lock_requires_/);
    assert.equal(fixture.calls.filter(args => args.at(-1).startsWith("SELECT coalesce")).length, 0);
  }
});

test("独立查询的真实空数组有效，异常JSON和非记录数组不能冒充空数据成功", () => {
  assert.equal(independentQueryFixture({ output: "[]" }).query("select 1").length, 0);
  for (const output of ["null", "{}", "[null]", "[[]]", "[1]", "invalid-json"]) {
    assert.throws(() => independentQueryFixture({ output }).query("select 1"));
  }
});

test("准备清理执行器绑定真实专属目标，允许写入并保留有界psql参数", () => {
  const fixture = independentQueryFixture({ sourceFile: "local-supabase.ts", output: "owned-write-result" });
  assert.equal(fixture.probe(), true);
  assert.equal(fixture.sql("insert into public.owned_fixture values (1) returning id;"), "owned-write-result");
  const args = fixture.calls.at(-1);
  assert.equal(args[4], dedicated.container);
  assert(args.includes("-XqAtw"));
  assert(args.includes("PGOPTIONS=-c statement_timeout=12000 -c lock_timeout=10000"));
  assert(!args.some(value => value.includes("default_transaction_read_only")));
});

test("准备清理执行器拒绝未声明、共享目标和活跃队列，状态查询不能放行它们", () => {
  for (const options of [
    { change: { PT5_E2E_FIXTURE_MODE: "" } },
    { change: { PT5_E2E_DATABASE_PROJECT: "pt5-dropshipping", PT5_E2E_DATABASE_CONTAINER: "supabase_db_pt5-dropshipping" } },
    { change: { NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321" } },
    { paused: "off|0|1" },
  ]) {
    const fixture = independentQueryFixture({ sourceFile: "local-supabase.ts", ...options });
    assert.equal(fixture.probe(), false);
    assert.throws(() => fixture.sql("delete from public.owned_fixture;"));
    assert.equal(fixture.calls.filter(args => args.includes("-XqAtw")).length, 0);
  }
});

test("准备清理执行器每次重新核对目标，不复用旧的放行结果", () => {
  const fixture = independentQueryFixture({ sourceFile: "local-supabase.ts", output: "first" });
  assert.equal(fixture.sql("select 1"), "first");
  fixture.env.PT5_E2E_DATABASE_PROJECT = "pt5-dropshipping";
  assert.throws(() => fixture.sql("select 2"));
  assert.equal(fixture.calls.filter(args => args.includes("-XqAtw")).length, 1);
});

test("准备清理执行失败不回显原始stdout/stderr资料，也不自动重试", () => {
  const fixture = independentQueryFixture({ sourceFile: "local-supabase.ts", sqlError: new Error("synthetic-private-data") });
  assert.throws(() => fixture.sql("select 1"), error => error.message.includes("未确认完成") && !error.message.includes("synthetic-private-data"));
  assert.equal(fixture.calls.filter(args => args.includes("-XqAtw")).length, 1);
});

test("费用SQL与订单/佣金读取共用专属执行器，保持原JSON结果和共享目标拒绝", () => {
  const fixture = independentQueryFixture({ sourceFile: "wholesale-fee-database.ts", output: '{"id":"owned-order"}' });
  assert.equal(fixture.sql("select 1"), '{"id":"owned-order"}');
  assert.equal(fixture.feeOrder("owned-order").id, "owned-order");
  assert.equal(fixture.feeCommission("owned-order").id, "owned-order");
  assert(fixture.calls.filter(args => args.includes("-XqAtw")).every(args => args[4] === dedicated.container));
  const callsBeforeInvalidId = fixture.calls.length;
  assert.throws(() => fixture.feeAttachmentObjects("invalid-order-id"), /attachment_fixture_order_id_invalid/);
  assert.equal(fixture.calls.length, callsBeforeInvalidId);
  fixture.env.PT5_E2E_DATABASE_PROJECT = "pt5-dropshipping";
  assert.throws(() => fixture.sql("delete from public.wholesale_orders"));
});

/** 只抽取每日额度的当前夹具/凭证函数；依赖明确替身，不执行原Auth或页面测试。 */
function dailyFixtureScenario(change={}){
  const file='tests/e2e/sales-lead-daily-limit.spec.ts',source=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  const names=['dailyCountSql','readDailyCount','readDailyLimitProof','writeDailyLead','withDailyLimitFixture'];
  const body=tree.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name.text)).map(n=>n.getText(tree)).join('\n');
  const actor='55555555-5555-4555-8555-555555555555',ids=Array.from({length:6},(_,i)=>`a6000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`),rows=new Map(),events=[];let cursor=0;
  const count=()=>[...rows.values()].filter(row=>row.status==='claimed').length+(change.existingCount??0);
  const readLocalPostgresRows=input=>{
    if(input.startsWith('select user_id from public.user_profiles'))return[{user_id:actor}];
    if(input.includes(' as daily_claims')){const id=input.match(/where l.id='([^']+)'/)[1],row=rows.get(id);return row?[{...row,daily_claims:count()}]:[];}
    assert(input.endsWith(' as count'));return[{count:count()}];
  };
  const runLocalSupabaseSql=input=>{
    for(const id of ids){
      if(input===learningLead.buildLearningLeadWriteSql('create',id)){events.push('create:'+id);if(!change.zeroCreate)rows.set(id,{id,name:`PT5 学习练习 ${id}`,status:'hall',current_assignee_user_id:null,current_assignment_id:null,history:[],contacts:[]});if(change.receiptLost&&id===ids[2])throw Error('third-create-receipt-lost');return 'WRITE_RECEIPT '+JSON.stringify({affected:change.zeroCreate?0:1});}
      if(input===learningLead.buildLearningLeadReadSql(id))return JSON.stringify({id,source:`PT5-LEARNING-${id}`,owned:rows.has(id),lead:rows.has(id)?{id,name:`PT5 学习练习 ${id}`,status:rows.get(id).status,row_version:'1'}:null,assignmentCount:rows.has(id)?rows.get(id).history.length:0,contactCount:0,sourceCount:0,identityCount:0});
      if(input===learningLead.buildLearningLeadWriteSql('cleanup',id)){events.push('cleanup:'+id);if(change.cleanupFailure&&id===ids[3])throw Error('fourth-cleanup-failed');const affected=rows.has(id)?1:0;rows.delete(id);return 'WRITE_RECEIPT '+JSON.stringify({affected});}
      if(input.includes(`public.claim_sales_lead('${id}')`)){events.push('claim:'+id);Object.assign(rows.get(id),{status:'claimed',current_assignee_user_id:actor,current_assignment_id:id,history:[{id}]});return '{}';}
    }throw Error('unexpected-daily-sql');
  };
  const fixtureModule={exports:{}};vm.runInNewContext(ts.transpileModule(body+';fixtureModule.exports={withDailyLimitFixture};',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{fixtureModule,AggregateError,expect:playwrightExpect,randomUUID:()=>ids[cursor++],quote:value=>"'"+value.replaceAll("'","''")+"'",readLocalPostgresRows,runLocalSupabaseSql,cleanupFixtureResources,...learningLead},{timeout:3000});
  const page={close:async()=>{events.push('close');if(change.closeFailure)throw Error('close-failed');}};
  return{rows,events,ids,run:body=>fixtureModule.exports.withDailyLimitFixture(page,'own@example.test',body)};
}

test('每日额度准备拒绝已有当天记录，不创建/清空/移动任何线索',async()=>{
  const h=dailyFixtureScenario({existingCount:1});let reached=false;await assert.rejects(h.run(async()=>{reached=true;}));assert.equal(reached,false);assert.deepEqual(h.events,['close']);
});

test('每日额度登记六随机ID、真实前四次接线，先关页再逆序完整清理',async()=>{
  const h=dailyFixtureScenario();let reached=false;await h.run(async fixture=>{reached=true;assert.equal(fixture.leads.length,6);assert.equal(h.rows.size,6);assert.equal(h.events.filter(e=>e.startsWith('claim:')).length,4);});assert(reached);assert.equal(h.rows.size,0);assert.deepEqual(h.events.slice(-7),['close',...h.ids.slice().reverse().map(id=>'cleanup:'+id)]);
});

test('每日额度第三次准备丢回执及创建零行，均不进入正文且回收已登记ID',async()=>{
  for(const change of [{receiptLost:true},{zeroCreate:true}]){const h=dailyFixtureScenario(change);let reached=false;await assert.rejects(h.run(async()=>{reached=true;}));assert.equal(reached,false);assert.equal(h.rows.size,0);assert(h.events.includes('cleanup:'+h.ids[0]));if(change.receiptLost)assert(h.events.includes('cleanup:'+h.ids[2]));}
});

test('每日额度正文/页面关闭/单条清理三错误保留，其他自有行仍全部回收',async()=>{
  const h=dailyFixtureScenario({closeFailure:true,cleanupFailure:true});await assert.rejects(h.run(async()=>{throw 0;}),error=>{assert.deepEqual([...error.errors].map(e=>e?.message??e),[0,'close-failed','fourth-cleanup-failed']);return error.message.includes(h.ids[3]);});assert.deepEqual([...h.rows.keys()],[h.ids[3]]);assert.equal(h.events.filter(e=>e.startsWith('cleanup:')).length,6);
});

/** 只执行协作矩阵的context生命周期；页面断言和登录端口明确模拟，不是原Auth套件。 */
function collaborationContextScenario(change={}){
  const file='tests/e2e/wholesale-salesman-collaboration.spec.ts',source=fs.readFileSync(file,'utf8'),tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true),node=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='expectDirectEditEntry'),events=[];
  const page={goto:async()=>events.push('goto'),getByLabel(){return this;},fill:async()=>{},getByTestId(){return this;},getByRole(){return this;},getByText(){return this;},click:async()=>events.push('click')};
  const browser={newContext:async options=>{events.push(['context',options.baseURL,options.viewport.width]);return{newPage:async()=>{events.push('page');if(change.failCreate)throw Error('page-create');return page;},close:async()=>{events.push('close');if(change.failClose)throw Error('context-close');}};}};
  const fixtureModule={exports:{}};
  vm.runInNewContext(ts.transpileModule(node.getText(tree)+';fixtureModule.exports=expectDirectEditEntry;',{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{fixtureModule,AggregateError,PEER_ORDER_ID:'c2000000-0000-4000-8000-000000000100',PEER_ORDER_NUMBER:'WH-PEER-LOCAL-001',expect:()=>({toBeVisible:async()=>{},toHaveCount:async()=>{}}),loginAs:async()=>{events.push('login-port');if(Object.hasOwn(change,'bodyThrows'))throw change.bodyThrows;},expectNoDocumentHorizontalOverflow:async()=>events.push('overflow-port')},{timeout:2000});
  return{events,run:(baseURL='http://localhost:3000',width=1440)=>fixtureModule.exports(browser,'salesman','/salesman/wholesale/orders',{width,height:900},baseURL)};
}

test('协作手动context须显式baseURL，缺地址时不创建浏览器资源',async()=>{
  const h=collaborationContextScenario();await assert.rejects(h.run(''),/显式本地页面地址/);assert.deepEqual(h.events,[]);
});

test('协作创建页面失败仍关闭刚登记context，并保留最初错误',async()=>{
  const h=collaborationContextScenario({failCreate:true});await assert.rejects(h.run(),e=>e.errors.length===1&&e.errors[0].message==='page-create');assert.deepEqual(h.events.slice(-2),['page','close']);assert(!h.events.includes('login-port'));
});

test('协作正文非Error值和context关闭失败分别保留',async()=>{
  const h=collaborationContextScenario({bodyThrows:0,failClose:true});await assert.rejects(h.run(),e=>e.errors.length===2&&e.errors[0]===0&&e.errors[1].message==='context-close');assert.equal(h.events.at(-1),'close');
});

test('协作桌面/手机两分支显式继承同一地址，并在正文后关闭context',async()=>{
  for(const width of [1440,390]){const h=collaborationContextScenario();await h.run('http://localhost:3000',width);assert.deepEqual(h.events[0],['context','http://localhost:3000',width]);assert.equal(h.events.at(-2),'overflow-port');assert.equal(h.events.at(-1),'close');assert.equal(h.events.includes('click'),width===390);}
});
