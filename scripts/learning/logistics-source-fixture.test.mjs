import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import test from 'node:test';
import {request as httpRequest} from 'node:http';
import {randomUUID} from 'node:crypto';
import {startLogisticsSourceServer} from '../../tests/test-support/logistics-source-server.ts';
import * as sql from '../../tests/test-support/logistics-fixture-sql.ts';
import {createLogisticsFixtureStore} from '../../tests/test-support/logistics-fixture-store.ts';
import * as boundary from '../../tests/test-support/disposable-fixture.ts';

const token='a1000000-0000-4000-8000-000000000001',operation='a1000000-0000-4000-8000-000000000002',hash='1'.repeat(32);
const cursor={order_id:0,tracking_updated_at:'1970-01-01T00:00:00.000Z',tracking_id:0,shipping_updated_at:'1970-01-01T00:00:00.000Z',shipping_id:0};
async function post(server,body,headers={}){
  return fetch(`http://127.0.0.1:${server.port}/source`,{method:'POST',headers:{'x-logistics-integration-token':'local-fixture',...headers},
    body:typeof body==='string'?body:JSON.stringify(body),signal:AbortSignal.timeout(3000)});
}
const body=orderId=>({mode:'incremental',limit:500,cursor:{...cursor,order_id:orderId}});

/** 所有Docker/Edge元数据和SQL回执均为明确的诊断端口；实际准入/构造器/生命周期在运行。 */
function harness(change={}){
  const project='pt5-e2e-logistics-source',calls=[],env={PLAYWRIGHT_BASE_URL:'http://127.0.0.1:3000',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:48121',
    PT5_E2E_FIXTURE_MODE:'disposable',PT5_E2E_DATABASE_PROJECT:project,PT5_E2E_DATABASE_CONTAINER:'supabase_db_'+project,...change.env};
  const prior=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));Object.assign(process.env,env);
  const run=(args,input)=>{
    calls.push({args,input});
    if(args[0]==='inspect')return JSON.stringify({labels:{'com.supabase.cli.project':project},running:true,
      env:change.edgeEnv??['LOGISTICS_SOURCE_ARCHIVE_API_URL=http://host.docker.internal:43194/source','LOGISTICS_SOURCE_ARCHIVE_API_TOKEN=local-fixture'],
      ports:{'8000/tcp':[{HostIp:'127.0.0.1',HostPort:change.port??'48121'}]},networks:{model:{NetworkID:change.network??'model-network'}}});
    if(!input)return change.idle??'off|0|0';
    if(input.includes('create table private.pt5_e2e_logistics_backup'))return JSON.stringify(change.prepare===undefined?{prepared:true,fingerprint:hash}:change.prepare);
    if(input.includes("pt5.fixture.logistics_receipt"))return JSON.stringify(change.restore===undefined?{restored:true,records:50,observations:1,operations:1,fingerprint:hash}:change.restore);
    if(input.startsWith('select jsonb_build_object(\'state\''))return JSON.stringify(change.preparedRead===undefined?{state:1,checkpoints:0,secret:1}:change.preparedRead);
    if(input.includes("'backup'"))return JSON.stringify(change.restoredRead===undefined?{fingerprint:hash,backup:false,records:0,observations:0,operations:0}:change.restoredRead);
    return JSON.stringify(change.rows??[]);
  };
  return {run,calls,close(){for(const[key,value]of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}};
}
function wrapper({prepareError,listenError,restoreError,sourceError}={}){
  const events=[],exports={};
  const source=fs.readFileSync(new URL('../../tests/e2e/helpers/logistics-source-fixture.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,require(name){
      if(name==='node:crypto')return {randomUUID};
      if(name.endsWith('logistics-fixture-sql'))return sql;
      if(name.endsWith('logistics-fixture-store'))return {createLogisticsFixtureStore:()=>({apiUrl:'http://127.0.0.1:48121',
        prepare(){events.push('prepare');if(prepareError)throw prepareError;},restore(_token,ids){events.push(['restore',ids]);if(restoreError)throw restoreError;},readRows(){return [];},execute(){}})};
      if(name.endsWith('logistics-source-server'))return {startLogisticsSourceServer:async()=>{
        events.push('listen');if(listenError)throw listenError;return {calls:[],errors:sourceError?['invalid']:[],recover(){},async close(){events.push('source-close');if(sourceError)throw sourceError;}};
      }};
      throw new Error('unexpected_fixture_dependency:'+name);
    },
  });return {events,exports};
}

test('来源真实HTTP保持25/429等待/恢复25与完整游标合同',async()=>{
  const server=await startLogisticsSourceServer({port:0,host:'127.0.0.1'});
  try{
    const first=await post(server,body(0)),data=await first.json();assert.equal(first.status,200);assert.equal(data.rows.length,25);assert.equal(data.next_cursor.order_id,9000025);assert.equal(data.has_more,true);
    for(let i=0;i<25;i++){assert.equal(data.rows[i].package_number,'LOCAL-RETRY-'+(i+1));assert.equal(data.rows[i].source_order_id,9000001+i);assert.equal(data.rows[i].shipping_cost,10);assert.equal(data.rows[i].shipping_currency,'USD');}
    const limit=await post(server,body(9000025));assert.equal(limit.status,429);assert.equal(limit.headers.get('retry-after'),'120');await limit.text();
    server.recover();const second=await post(server,body(9000025)),last=await second.json();assert.equal(second.status,200);assert.equal(last.rows.length,25);
    assert.equal(last.rows[0].source_order_id,9000026);assert.equal(last.rows.at(-1).source_order_id,9000050);assert.equal(last.has_more,false);
    assert.deepEqual(server.calls.map(c=>c.orderId),[0,9000025,9000025]);assert.deepEqual(server.errors,[]);
  }finally{await server.close();await server.close();}
});
test('非法JSON返回明确400，同一个服务随后仍能处理有效请求',async()=>{
  const server=await startLogisticsSourceServer({port:0,host:'127.0.0.1'});
  try{const invalid=await post(server,'{');assert.equal(invalid.status,400);await invalid.text();const valid=await post(server,body(0));assert.equal(valid.status,200);await valid.text();assert.deepEqual(server.errors,['fixture_json_invalid']);}
  finally{await server.close();}
});
test('错误方法/令牌及停滞游标不会被当成有效来源调用',async()=>{
  const server=await startLogisticsSourceServer({port:0,host:'127.0.0.1'});
  try{
    const denied=await post(server,body(0),{'x-logistics-integration-token':'wrong'});assert.equal(denied.status,403);await denied.text();
    const get=await fetch(`http://127.0.0.1:${server.port}/source`,{headers:{'x-logistics-integration-token':'local-fixture'}});assert.equal(get.status,405);await get.text();
    const wrong=await post(server,body(9000050));assert.equal(wrong.status,400);await wrong.text();assert.equal(server.calls.length,0);
  }finally{await server.close();}
});
test('半个HTTP请求与重复收尾不会留下监听端口',async()=>{
  const server=await startLogisticsSourceServer({port:0,host:'127.0.0.1'});
  const request=httpRequest({host:'127.0.0.1',port:server.port,path:'/source',method:'POST',headers:{'x-logistics-integration-token':'local-fixture','content-length':'1000'}});
  request.on('error',()=>{});request.write('{');await new Promise(resolve=>setTimeout(resolve,30));
  await server.close();request.destroy();await server.close();
  await assert.rejects(fetch(`http://127.0.0.1:${server.port}/source`,{signal:AbortSignal.timeout(1000)}));
});
test('同一端口已被占用时拒绝新来源，不关闭原监听者',async()=>{
  const server=await startLogisticsSourceServer({port:0,host:'127.0.0.1'});
  try{await assert.rejects(startLogisticsSourceServer({port:server.port,host:'127.0.0.1'}),error=>error.code==='EADDRINUSE');const response=await post(server,body(0));assert.equal(response.status,200);await response.text();}
  finally{await server.close();}
});
test('共享项目/缺声明/错误API/未暂停，在任何写入前拒绝',()=>{
  for(const change of [{env:{PT5_E2E_FIXTURE_MODE:''}},{env:{PT5_E2E_DATABASE_PROJECT:'pt5-dropshipping'}},{port:'48122'},{idle:'on|0|0'}]){
    const h=harness(change);try{assert.throws(()=>createLogisticsFixtureStore(h.run));assert(!h.calls.some(c=>c.input));}finally{h.close();}
  }
});
test('实际Edge来源未明确本地模拟时拒绝，不打印原环境值',()=>{
  const h=harness({edgeEnv:['LOGISTICS_SOURCE_ARCHIVE_API_URL=https://source.example.invalid','LOGISTICS_SOURCE_ARCHIVE_API_TOKEN=do-not-print']});
  try{assert.throws(()=>createLogisticsFixtureStore(h.run),error=>error.message==='logistics_fixture_edge_mock_unconfirmed'&&!error.message.includes('do-not-print'));assert(!h.calls.some(c=>c.input));}finally{h.close();}
});
test('准备和恢复都读取独立终态，宿主机只得到原配置指纹',()=>{
  const h=harness();try{const store=createLogisticsFixtureStore(h.run);store.prepare(token);const receipt=store.restore(token,[operation]);assert.equal(receipt.records,50);
    assert(!h.calls.some(c=>c.input?.includes('original-secret')));assert.equal(h.calls.filter(c=>c.input).length,4);}finally{h.close();}
});
test('缺准备回执或独立状态错误不能继续启动来源',()=>{
  for(const change of [{prepare:null},{prepare:{prepared:true,fingerprint:null}},{preparedRead:{state:0,checkpoints:0,secret:1}}]){
    const h=harness(change);try{assert.throws(()=>createLogisticsFixtureStore(h.run).prepare(token));}finally{h.close();}
  }
});
test('恢复影响数、配置指纹、残留及备份存在都必须符合',()=>{
  for(const change of [{restore:null},{restore:{restored:true,records:51,observations:1,operations:1,fingerprint:hash}},
    {restore:{restored:true,records:50,observations:1,operations:0,fingerprint:hash}},
    {restoredRead:{fingerprint:hash,backup:true,records:0,observations:0,operations:0}},
    {restoredRead:{fingerprint:hash,backup:false,records:1,observations:0,operations:0}},
    {restoredRead:{fingerprint:'2'.repeat(32),backup:false,records:0,observations:0,operations:0}}]){
    const h=harness(change);try{const store=createLogisticsFixtureStore(h.run);store.prepare(token);assert.throws(()=>store.restore(token,[operation]));}finally{h.close();}
  }
});
test('准备未提交或已经恢复的收尾也要求零残留和已知原指纹',()=>{
  const h=harness({restore:{restored:false,notPrepared:true}});try{const store=createLogisticsFixtureStore(h.run);store.prepare(token);assert.equal(store.restore(token,[operation]).notPrepared,true);}finally{h.close();}
});
test('非法/重复任务编号在任何恢复写入前拒绝',()=>{
  assert.throws(()=>sql.buildLogisticsFixtureRestoreSql(token,[operation,operation]));assert.throws(()=>sql.buildLogisticsFixtureRestoreSql(token,["';delete from private.operation_runs;--"]));assert.throws(()=>sql.buildLogisticsFixturePrepareSql('bad'));
});
test('SQL准备失败不启动监听，仍尝试核对本次是否已准备',async()=>{
  const error=new Error('prepare failed'),h=wrapper({prepareError:error});await assert.rejects(h.exports.startLogisticsSourceFixture(),caught=>caught===error);
  assert.equal(h.events.includes('listen'),false);assert.equal(h.events.filter(e=>Array.isArray(e)&&e[0]==='restore').length,1);
});
test('监听失败后恢复已提交配置；两次错误同时保留',async()=>{
  const listen=new Error('listen failed'),restore=new Error('restore failed');const h=wrapper({listenError:listen,restoreError:restore});
  await assert.rejects(h.exports.startLogisticsSourceFixture(),error=>error.message==='logistics_fixture_prepare_and_cleanup_failed'&&error.errors[0]===listen&&error.errors[1].errors[0]===restore);
});
test('关闭来源失败仍尝试SQL恢复，任务编号只接收明确UUID',async()=>{
  const source=new Error('source close failed'),restore=new Error('restore failed'),h=wrapper({sourceError:source,restoreError:restore});
  const fixture=await h.exports.startLogisticsSourceFixture();assert.throws(()=>fixture.recordOperation(undefined));fixture.recordOperation(operation);
  await assert.rejects(fixture.close(),error=>error.errors[0]===source&&error.errors[1]===restore);
  const call=h.events.find(e=>Array.isArray(e)&&e[0]==='restore');assert.equal(call[1][0],operation);
});
test('数据库错误仅保留白名单编号，不泄露DETAIL中的配置值',()=>{
  const source=fs.readFileSync(new URL('../../tests/test-support/logistics-fixture-store.ts',import.meta.url),'utf8'),exports={};
  const failure=Object.assign(new Error('private config'),{stderr:'ERROR:  logistics_fixture_restore_unconfirmed\nDETAIL: secret=do-not-print\n'});
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,require(name){if(name==='node:child_process')return {execFileSync(){throw failure;}};if(name.endsWith('disposable-fixture.ts'))return boundary;if(name.endsWith('logistics-fixture-sql.ts'))return sql;throw new Error(name);}});
  assert.throws(()=>exports.runLogisticsFixtureCommand([]),error=>error.message==='logistics_fixture_restore_unconfirmed'&&!error.cause);
});
test('原页面网络准入内核只允许声明的Web/API，拒绝共享与相邻本机端口',async()=>{
  const source=fs.readFileSync(new URL('../../tests/e2e/wholesale-logistics-sync.spec.ts',import.meta.url),'utf8');
  const file=ts.createSourceFile('test.ts',source,ts.ScriptTarget.Latest,true);let callback;
  function visit(node){
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&node.expression.name.text==='beforeEach')callback=node.arguments[0];
    ts.forEachChild(node,visit);
  }visit(file);assert(callback);
  const fn=vm.runInNewContext(ts.transpileModule('const hook='+callback.getText(file)+';hook;',{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.None}}).outputText,
  {URL,Set,requireDisposableFixture:boundary.requireDisposableFixture,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:48121',PT5_E2E_FIXTURE_MODE:'disposable'}}});
  let routeHandler;await fn({page:{async route(_pattern,handler){routeHandler=handler;}},baseURL:'http://127.0.0.1:3000'});
  for(const [url,expected]of [['http://127.0.0.1:3000/admin/wholesale/logistics','continue'],['http://127.0.0.1:48121/functions/v1/x','continue'],
    ['http://127.0.0.1:48021/functions/v1/x','abort'],['http://127.0.0.1:48122/rest/v1/x','abort'],['https://source.example.invalid','abort']]){
    let action;await routeHandler({request:()=>({url:()=>url}),continue:()=>{action='continue';},abort:()=>{action='abort';}});assert.equal(action,expected);
  }
});
