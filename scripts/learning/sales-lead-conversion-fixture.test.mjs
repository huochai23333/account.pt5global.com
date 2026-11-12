import {expect as playwrightExpect} from '@playwright/test';
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as contracts from '../../tests/test-support/sales-lead-conversion-proof.ts';
import * as sql from '../../tests/test-support/sales-lead-conversion-cleanup-sql.ts';
import * as store from '../../tests/test-support/sales-lead-conversion-store.ts';
import * as learning from '../../../PT5-dropshipping-supabase/scripts/learning-lead-fixture-sql.mjs';
import {cleanupFixtureResources} from '../../tests/test-support/fixture-cleanup-sequence.ts';
const lead='a5000000-0000-4000-8000-000000000001',customer='b1000000-0000-4000-8000-000000000001',
  owner='55555555-5555-4555-8555-555555555555',assignment='c1000000-0000-4000-8000-000000000001',now='2026-11-10T00:00:00.000Z';
const good={lead_id:lead,status:'converted',source_id:'source-'+lead,lead_name:'本次线索',customer_id:customer,owner,lead_owner:owner,
  assignment_id:assignment,assignment_lead_id:lead,assignment_owner:owner,customer_name:'线索转换回归 '+lead,customer_version:now,customer_revision:1,
  customer_kind:'sales_created',registered_user_id:null,customer_creator:owner,customer_notes:'本次客户备注',converted_by:owner,converted_at:now,
  ended_by:owner,ended_reason:'converted',ended_at:now,fixture_name_count:1};
const unconverted={...good,status:'claimed',customer_id:null,fixture_name_count:0};
const manifest=()=>contracts.createSalesLeadConversionManifest(lead,unconverted,good.customer_notes);

/** 编译当前接线，纯状态端口替代SQL/定位器；不读取账号/Auth辅助，不冒称浏览器通过。 */
function helper(){
  const text=fs.readFileSync(new URL('../../tests/e2e/helpers/sales-lead-conversion.ts',import.meta.url),'utf8');
  const exports={},events=[];let proof=unconverted;
  vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
    exports,require(name){
      if(name==='@playwright/test')return {expect:()=>({toBeEnabled:async()=>{},toBeVisible:async()=>{}})};
      if(name.endsWith('sales-lead-conversion-proof'))return contracts;
      if(name.endsWith('sales-lead-conversion-store'))return {readLocalSalesLeadCustomerProof:()=>{events.push('read');return proof;},
        cleanupLocalSalesLeadConversion:m=>{events.push(['cleanup',m]);return {deleted:1};}};
      throw new Error('unexpected_helper_dependency:'+name);
    },
  });
  const page={getByRole(){return this;},getByText(){return this;},getByTestId(id){return {fill:async value=>events.push([id,value]),
    click:async()=>{proof=good;}};},click:async()=>{}};
  return {exports,events,page};
}
function harness(change={}){
  const calls=[],project='pt5-e2e-conversion-proof';
  const env={PLAYWRIGHT_BASE_URL:'http://localhost:3000',NEXT_PUBLIC_SUPABASE_URL:'http://127.0.0.1:48121',PT5_E2E_FIXTURE_MODE:'disposable',
    PT5_E2E_DATABASE_PROJECT:project,PT5_E2E_DATABASE_CONTAINER:'supabase_db_'+project,...change.env};
  const prior=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));Object.assign(process.env,env);
  const remaining={lead:{id:lead,source:good.source_id,name:good.lead_name,status:'hall',customerId:null},customers:0};
  const run=(args,input)=>{
    calls.push({args,input});
    if(args[0]==='inspect')return JSON.stringify({labels:{'com.supabase.cli.project':project},running:true,ports:{'8000/tcp':[{HostIp:'127.0.0.1',HostPort:change.port??'48121'}]},networks:{fixture:{NetworkID:'model-network'}}});
    if(!input)return change.idle??'off|0|0';
    if(input.includes("pt5.fixture.conversion_receipt"))return JSON.stringify(change.receipt===undefined?{leadId:lead,customerId:customer,deleted:1,reset:1}:change.receipt);
    if(input.includes("'fixture_name_count'"))return JSON.stringify(change.proof===undefined?good:change.proof);
    return JSON.stringify(change.remaining===undefined?remaining:change.remaining);
  };
  const close=()=>{for(const[key,value]of Object.entries(prior)){if(value===undefined)delete process.env[key];else process.env[key]=value;}};
  return {calls,run,close};
}

test('负责人两NULL及无效时间均不能作为有效凭证',()=>{
  for(const bad of [{...good,owner:null,lead_owner:null},{...good,customer_version:'not-a-date',ended_at:'also-invalid'}]){
    assert.throws(()=>contracts.validateSalesLeadCustomerProof(lead,bad));
  }
});
test('有效客户/周期/创建人与结束人凭证通过，ID和空正文不可省略',()=>{
  assert.equal(contracts.validateSalesLeadCustomerProof(lead,good),good);
  for(const bad of [null,[],{...good,lead_id:customer},{...good,customer_id:null}])assert.throws(()=>contracts.validateSalesLeadCustomerProof(lead,bad));
});
test('负责人、周期和实际转换/创建/结束人错配均拒绝',()=>{
  for(const patch of [{owner:customer},{assignment_owner:customer},{assignment_lead_id:customer},{customer_creator:customer},{ended_by:customer}])
    assert.throws(()=>contracts.validateSalesLeadCustomerProof(lead,{...good,...patch}));
});
test('错误客户种类/注册归属/名称/修订及终态均拒绝',()=>{
  for(const patch of [{customer_kind:'registered'},{registered_user_id:customer},{customer_name:''},{customer_revision:null},{customer_revision:0},{status:'claimed'},{ended_reason:null}])
    assert.throws(()=>contracts.validateSalesLeadCustomerProof(lead,{...good,...patch}));
});
test('页面前清单拒绝已有客户、已有专属名称、空来源或错误周期',()=>{
  for(const patch of [{customer_id:customer},{fixture_name_count:1},{source_id:''},{assignment_id:null}])
    assert.throws(()=>contracts.createSalesLeadConversionManifest(lead,{...unconverted,...patch},good.customer_notes));
});
test('清单只绑定同一周期、负责人、预定名称与备注',()=>{
  const m=manifest();contracts.bindSalesLeadConversionManifest(m,good);assert.equal(m.customerId,customer);assert.equal(m.customerRevision,1);
  for(const patch of [{customer_name:'别的客户'},{customer_notes:'别的备注'},{assignment_id:customer},{lead_owner:customer,owner:customer,assignment_owner:customer}])
    assert.throws(()=>contracts.bindSalesLeadConversionManifest(manifest(),{...good,...patch}));
});
test('UUID与自由SQL输入在任何命令前拒绝，美元标签不会截断DO',()=>{
  for(const id of ["';delete from public.sales_leads;--",'',lead.toUpperCase()])assert.throws(()=>sql.buildSalesLeadProofSql(id));
  const input=sql.buildSalesLeadConversionCleanupSql({...manifest(),notes:"a' $$ $pt5_conversion_0$ end; --"});
  assert.match(input,/do \$pt5_conversion_1\$/);assert.match(input,/a'' \$\$/);assert(!input.includes('do $$'));
});
test('实际DB/Kong/API和暂停状态不符时，不执行清理SQL',()=>{
  for(const change of [{env:{PT5_E2E_FIXTURE_MODE:''}},{env:{PT5_E2E_DATABASE_PROJECT:'pt5-dropshipping'}},{port:'48122'},{idle:'on|0|0'}]){
    const h=harness(change);try{assert.throws(()=>store.cleanupLocalSalesLeadConversion(manifest(),h.run));assert(!h.calls.some(c=>c.input));}finally{h.close();}
  }
});
test('按同一目标独立读回，准确删除回执与零客户才通过',()=>{
  const h=harness();try{assert.equal(store.readLocalSalesLeadCustomerProof(lead,h.run).customer_id,customer);
    const receipt=store.cleanupLocalSalesLeadConversion(manifest(),h.run);assert.equal(receipt.deleted,1);
    assert.equal(h.calls.filter(c=>c.input).length,3);assert.equal(h.calls.filter(c=>c.args[0]==='inspect').length,6);
  }finally{h.close();}
});
test('缺失/错误/零假回执及不一致影响数都拒绝',()=>{
  for(const receipt of [null,{}, {leadId:lead,customerId:null,deleted:1,reset:1},{leadId:customer,customerId:customer,deleted:1,reset:1},
    {leadId:lead,customerId:customer,deleted:1,reset:0},{leadId:lead,customerId:customer,deleted:2,reset:2}]){
    const h=harness({receipt});try{assert.throws(()=>store.cleanupLocalSalesLeadConversion(manifest(),h.run));}finally{h.close();}
  }
});
test('绑定客户ID不能被回执更换，清理后残留或父行变化仍失败',()=>{
  const m=manifest();contracts.bindSalesLeadConversionManifest(m,good);
  const changes=[{receipt:{leadId:lead,customerId:assignment,deleted:1,reset:1}},{remaining:{lead:null,customers:0}},
    {remaining:{lead:{id:lead,source:good.source_id,name:good.lead_name,status:'hall',customerId:customer},customers:1}}];
  for(const change of changes){const h=harness(change);try{assert.throws(()=>store.cleanupLocalSalesLeadConversion(m,h.run));}finally{h.close();}}
});
test('确认没有转换的零影响收尾需要独立零客户和原父行，不冒称删除',()=>{
  const h=harness({receipt:{leadId:lead,customerId:null,deleted:0,reset:0},remaining:{lead:{id:lead,source:good.source_id,name:good.lead_name,status:'claimed',customerId:null},customers:0}});
  try{assert.equal(store.cleanupLocalSalesLeadConversion(manifest(),h.run).deleted,0);}finally{h.close();}
});
test('未登记页面写入前清单时，不接收任意ID执行清理',()=>{
  const h=helper();assert.throws(()=>h.exports.cleanupSalesLeadConversion(lead),/manifest_missing/);assert.equal(h.events.length,0);
});
test('实际接线先登记后提交并绑定独立凭证，同一清单可供重复收尾',async()=>{
  const h=helper(),proof=await h.exports.saveOpenLeadAsCustomer(h.page,lead,good.customer_notes);
  assert.equal(proof.customer_id,customer);assert.equal(h.events[0],'read');h.exports.cleanupSalesLeadConversion(lead);h.exports.cleanupSalesLeadConversion(lead);
  const cleanup=h.events.filter(event=>Array.isArray(event)&&event[0]==='cleanup');assert.equal(cleanup.length,2);
  assert.equal(cleanup[0][1],cleanup[1][1]);assert.equal(cleanup[0][1].customerId,customer);
});

/** 只运行当前大厅的夹具/资源函数，SQL状态与浏览器端口明确模拟；不加载原Auth/账号import。 */
function hallLifecycleScenario(change={},spec='sales-leads'){
  assert(['sales-leads','sales-lead-admin-claim'].includes(spec));
  const file=new URL(`../../tests/e2e/${spec}.spec.ts`,import.meta.url),source=fs.readFileSync(file,'utf8');
  const tree=ts.createSourceFile(file.pathname,source,ts.ScriptTarget.Latest,true),names=['executeOwnedLead','withOwnedLead','finishLeadTest'];
  const body=tree.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name.text)).map(n=>n.getText(tree)).join('\n');
  const quoteText=fs.readFileSync(new URL('../../tests/e2e/helpers/local-postgres-query.ts',import.meta.url),'utf8');
  const quoteTree=ts.createSourceFile('local-postgres-query.ts',quoteText,ts.ScriptTarget.Latest,true);
  const quoteNode=quoteTree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='localSqlValue'),quoteModule={exports:{}};
  vm.runInNewContext(ts.transpileModule(quoteNode.getText(quoteTree).replace(/^export /,'')+';quoteModule.exports=localSqlValue;',{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText,{quoteModule},{timeout:2000});
  const events=[],contexts=[],state={row:false};
  const runLocalSupabaseSql=input=>{
    if(input===learning.buildLearningLeadWriteSql('create',lead)){
      events.push('create');state.row=!change.zeroCreate;
      if(change.createReceiptLost)throw new Error('create-receipt-lost');
      return 'WRITE_RECEIPT '+JSON.stringify({affected:state.row?1:0});
    }
    if(input===learning.buildLearningLeadWriteSql('cleanup',lead)){
      events.push('lead-cleanup');if(change.cleanupError)throw change.cleanupError;
      const affected=state.row?1:0;if(!change.keepRow)state.row=false;
      return 'WRITE_RECEIPT '+JSON.stringify({affected:change.keepRow?0:affected});
    }
    if(input===learning.buildLearningLeadReadSql(lead)){
      events.push('read');return JSON.stringify({id:lead,source:`PT5-LEARNING-${lead}`,owned:state.row,
        lead:state.row?{id:lead,name:`PT5 学习练习 ${lead}`,status:'hall',row_version:'1'}:null,
        assignmentCount:0,contactCount:0,sourceCount:0,identityCount:0});
    }
    assert(input.startsWith('update public.sales_leads set email='));events.push('contact-data');return state.row?lead:'';
  };
  let attemptedContexts=0;
  const browser={newContext:async options=>{
    assert.equal(options.baseURL,'http://localhost:3000');attemptedContexts++;
    if(change.secondContextFails&&attemptedContexts===2)throw new Error('second-context-failed');
    const index=contexts.length,context={closed:false,newPage:async()=>{
      if(change.pageFails)throw new Error('page-create-failed');return{index};
    },close:async()=>{events.push('close-'+index);context.closed=true;if(index===0&&change.closeError)throw change.closeError;}};
    contexts.push(context);return context;
  }};
  const fixtureModule={exports:{}};
  vm.runInNewContext(ts.transpileModule(body+'\nfixtureModule.exports={withOwnedLead};',{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS},
  }).outputText,{fixtureModule,AggregateError,randomUUID:()=>lead,runLocalSupabaseSql,
    ...learning,localSqlValue:quoteModule.exports,cleanupFixtureResources,cleanupSalesLeadConversion:()=>{events.push('conversion-cleanup');if(change.conversionError)throw change.conversionError;}},{timeout:2000});
  return {state,events,contexts,run:body=>fixtureModule.exports.withOwnedLead('http://localhost:3000',fixture=>body(fixture,browser))};
}

// 同一故障矩阵分别执行两份当前调用方，防止只修大厅而管理员仍漏收尾。
for(const spec of ['sales-leads','sales-lead-admin-claim']){
test(spec+'：'+'大厅夹具显式继承baseURL，先关两上下文再精确清理转换和线索',async()=>{
  const h=hallLifecycleScenario({},spec);await h.run(async(fixture,browser)=>{await fixture.openPage(browser);await fixture.openPage(browser);fixture.markConversion();});
  assert.equal(h.state.row,false);assert(h.contexts.every(c=>c.closed));
  assert.deepEqual(h.events.filter(e=>e.startsWith('close-')||e.endsWith('cleanup')),['close-0','close-1','conversion-cleanup','lead-cleanup']);
});

test(spec+'：'+'大厅准备已提交但回执丢失时仍按预登记UUID清理',async()=>{
  const h=hallLifecycleScenario({createReceiptLost:true},spec);let called=false;
  await assert.rejects(h.run(async()=>{called=true;}),error=>error.message.includes(lead)&&error.errors[0].message==='create-receipt-lost');
  assert.equal(called,false);assert.equal(h.state.row,false);assert(h.events.includes('lead-cleanup'));
});

test(spec+'：'+'大厅第二上下文或页面创建失败时，已有上下文和本次线索都收尾',async()=>{
  for(const change of [{secondContextFails:true},{pageFails:true}]){
    const h=hallLifecycleScenario(change,spec);await assert.rejects(h.run(async(fixture,browser)=>{await fixture.openPage(browser);await fixture.openPage(browser);}));
    assert.equal(h.contexts.length,1);assert(h.contexts[0].closed);assert.equal(h.state.row,false);
  }
});

test(spec+'：'+'大厅准备零行不得进入正文，清理零行但仍有父行也必须失败',async()=>{
  const zero=hallLifecycleScenario({zeroCreate:true},spec);let called=false;await assert.rejects(zero.run(async()=>{called=true;}));
  assert.equal(called,false);assert.equal(zero.state.row,false);
  const remaining=hallLifecycleScenario({keepRow:true},spec);await assert.rejects(remaining.run(async()=>{}));assert.equal(remaining.state.row,true);
});

test(spec+'：'+'大厅正文的非Error值和关闭/转换/线索收尾四个失败均保留',async()=>{
  const close=new Error('close'),conversion=new Error('conversion'),cleanup=new Error('cleanup');
  const h=hallLifecycleScenario({closeError:close,conversionError:conversion,cleanupError:cleanup},spec);
  await assert.rejects(h.run(async(fixture,browser)=>{await fixture.openPage(browser);fixture.markConversion();throw 0;}),error=>{
    assert.deepEqual([...error.errors],[0,close,conversion,cleanup]);return error.message.includes(lead);
  });
  assert.equal(h.state.row,true);assert(h.events.includes('lead-cleanup'));
});
}

/** 只载入独立夹具的声明依赖；SQL/页面端口可替换，Auth及账号模块始终不加载。 */
function conversionFixtureHarness(change={}){
  const ids=[lead,'a5000000-0000-4000-8000-000000000002'],events=[],state=new Map();let cursor=0;
  const readProof=id=>state.get(id)?.proof;
  const readRows=input=>{
    if(input.includes('coalesce(name,email'))return[{user_id:owner,name:'测试业务员'}];
    if(input.includes('count(*)::integer'))return[{count:0}];
    if(input.includes("r.role='administrator'"))return[{user_id:'11111111-1111-4111-8111-111111111111'}];
    if(input.includes("r.role='salesman'"))return[{user_id:'55555555-5555-4555-8555-555555555556'}];
    throw Error('unexpected-read-port');
  };
  const runSql=input=>{
    for(const id of ids){
      if(input===learning.buildLearningLeadWriteSql('create',id)){
        state.set(id,{proof:{...unconverted,lead_id:id,lead_name:`PT5 学习练习 ${id}`,source_id:`PT5-LEARNING-${id}`,ended_at:null,ended_by:null,ended_reason:null}});events.push('create:'+id);
        if(change.createReceiptLost)throw Error('committed-create-receipt-lost');return 'WRITE_RECEIPT '+JSON.stringify({affected:1});
      }
      if(input===learning.buildLearningLeadReadSql(id))return JSON.stringify({id,source:`PT5-LEARNING-${id}`,owned:state.has(id),lead:state.has(id)?{id,name:`PT5 学习练习 ${id}`,status:'hall',row_version:'1'}:null,assignmentCount:0,contactCount:0,sourceCount:0,identityCount:0});
      if(input===learning.buildLearningLeadWriteSql('cleanup',id)){events.push('lead:'+id);state.delete(id);return 'WRITE_RECEIPT '+JSON.stringify({affected:1});}
      if(input.includes(`where id='${id}'`)&&input.startsWith('update public.sales_leads set email='))return id;
      if(input.includes(`public.claim_sales_lead('${id}')`))return '{}';
    }if(input.includes('update public.wholesale_customers set assigned_sales_user_id=')){
      events.push('owner-write');const target=input.match(/set assigned_sales_user_id='([^']+)'/)[1],entry=state.get(ids[0]);
      entry.proof={...entry.proof,owner:target,customer_revision:entry.proof.customer_revision+1,customer_version:'2026-11-10T00:00:0'+(entry.proof.customer_revision+1)+'.000Z'};return entry.proof.customer_id;
    }throw Error('unexpected-write-port');
  };
  const quoteText=fs.readFileSync(new URL('../../tests/e2e/helpers/local-postgres-query.ts',import.meta.url),'utf8'),quoteTree=ts.createSourceFile('quote.ts',quoteText,ts.ScriptTarget.Latest,true),quoteNode=quoteTree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text==='localSqlValue');
  const fixtureModule={exports:{}},quoteModule={exports:{}};
  vm.runInNewContext(ts.transpileModule(quoteNode.getText(quoteTree).replace(/^export /,'')+';quoteModule.exports=localSqlValue;', {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{quoteModule});
  const ports={'@playwright/test':{expect:playwrightExpect},'node:crypto':{randomUUID:()=>ids[cursor++]},'./local-supabase':{runLocalSupabaseSql:runSql},'./local-postgres-query':{readLocalPostgresRows:readRows,localSqlValue:quoteModule.exports},'../../test-support/fixture-cleanup-sequence':{cleanupFixtureResources},'../../test-support/sales-lead-conversion-proof':contracts,'../../../../PT5-dropshipping-supabase/scripts/learning-lead-fixture-sql.mjs':learning,'../../test-support/sales-lead-conversion-store':{readLocalSalesLeadCustomerProof:readProof,cleanupLocalSalesLeadConversion:manifest=>{events.push('conversion:'+manifest.leadId);if(change.cleanupError&&manifest.leadId===ids[1])throw Error('conversion-cleanup');return{deleted:0,reset:0};}}};
  const text=fs.readFileSync(new URL('../../tests/e2e/helpers/sales-lead-conversion-fixture.ts',import.meta.url),'utf8');
  vm.runInNewContext(ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:fixtureModule.exports,AggregateError,require:name=>{if(!(name in ports))throw Error('unexpected-fixture-dependency:'+name);return ports[name];}},{timeout:3000});
  const page={unrouteAll:async options=>{assert.equal(options.behavior,'wait');events.push('unroute');if(change.unrouteError)throw Error('unroute');},close:async()=>{events.push('close');if(change.closeError)throw Error('close');}};
  return{...fixtureModule.exports,state,events,page,run:body=>fixtureModule.exports.withSalesLeadConversionFixture(page,'own@example.test',body)};
}

test('转换备注仅接纳页面前登记的一次修订，更新严格清理版本',()=>{
  const h=conversionFixtureHarness(),m=manifest();contracts.bindSalesLeadConversionManifest(m,good);
  const item={id:lead,name:'本次线索',manifest:m,edit:{before:good,notes:'预登记新备注'}};
  const after={...good,customer_notes:item.edit.notes,customer_revision:2,customer_version:'2026-11-10T00:00:01.000Z'};
  h.acceptExpectedConversionEdit(item,after);assert.equal(m.notes,after.customer_notes);assert.equal(m.customerRevision,2);assert.equal(item.edit,undefined);
});

test('转换备注拒绝错ID/负责人/来源/修订/时间，失败不能更新清理基线',()=>{
  const h=conversionFixtureHarness();
  for(const patch of [{customer_id:assignment},{owner:customer},{source_id:'foreign'},{customer_revision:3},{customer_version:now},{customer_version:null},{customer_notes:'其他写入'}]){
    const m=manifest();contracts.bindSalesLeadConversionManifest(m,good);const saved=structuredClone(m);
    const item={id:lead,name:'本次线索',manifest:m,edit:{before:good,notes:'预登记新备注'}};
    assert.throws(()=>h.acceptExpectedConversionEdit(item,{...good,customer_notes:item.edit.notes,customer_revision:2,customer_version:'2026-11-10T00:00:01.000Z',...patch}));assert.deepEqual(m,saved);assert(item.edit);
  }
});

test('未登记编辑不能事后接纳数据库新值',()=>{
  const h=conversionFixtureHarness();assert.throws(()=>h.acceptExpectedConversionEdit({id:lead,manifest:manifest()},good),/edit_not_registered/);
});

test('转换准备提交后丢回执，正文不运行仍按预登记ID回收并关闭页面',async()=>{
  const h=conversionFixtureHarness({createReceiptLost:true});let called=false;
  await assert.rejects(h.run(async fixture=>{fixture.create();called=true;}),e=>e.message.includes(lead)&&e.errors[0].message==='committed-create-receipt-lost');
  assert.equal(called,false);assert.equal(h.state.size,0);assert.deepEqual(h.events.slice(-3),['unroute','close','lead:'+lead]);
});

test('转换两条自有线索逆序收尾，正文/拦截/关闭/客户清理四错误全部保留',async()=>{
  const h=conversionFixtureHarness({unrouteError:true,closeError:true,cleanupError:true});
  await assert.rejects(h.run(async fixture=>{fixture.create();fixture.create();throw 0;}),e=>{
    assert.deepEqual([...e.errors].map(x=>x?.message??x),[0,'unroute','close','conversion-cleanup']);return e.message.includes('a5000000-0000-4000-8000-000000000002');});
  assert.equal(h.state.size,0);assert.deepEqual(h.events.slice(-4),['conversion:a5000000-0000-4000-8000-000000000002','lead:a5000000-0000-4000-8000-000000000002','conversion:'+lead,'lead:'+lead]);
});

test('转换已确认后未知修订变化不能被普通confirm重新绑定',async()=>{
  const h=conversionFixtureHarness();let confirmed=false;await assert.rejects(h.run(async fixture=>{
    const item=fixture.create();h.state.get(item.id).proof={...good,source_id:item.manifest.sourceId,lead_name:item.name,customer_notes:item.manifest.notes};
    fixture.confirm(item);confirmed=true;h.state.get(item.id).proof.customer_revision=2;fixture.confirm(item);
  }));assert.equal(confirmed,true);assert.equal(h.state.size,0);
});

test('转换联系方式断言接受真实草稿生成的多行六渠道内容',()=>{
  const spec=fs.readFileSync(new URL('../../tests/e2e/sales-lead-conversion.spec.ts',import.meta.url),'utf8');
  const tree=ts.createSourceFile('conversion.ts',spec,ts.ScriptTarget.Latest,true);let expression;
  const visit=n=>{if(ts.isNewExpression(n)&&n.expression.getText(tree)==='RegExp')expression=n.getText(tree);ts.forEachChild(n,visit);};visit(tree);assert(expression);
  const draftSource=fs.readFileSync(new URL('../../components/dashboard/sales-leads/sales-lead-customer-draft.ts',import.meta.url),'utf8'),exports={};
  vm.runInNewContext(ts.transpileModule(draftSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:()=>{throw Error('unexpected-draft-runtime-import');}},{timeout:2000});
  const item={id:lead,name:'专属线索',primary_source_lead_id:'source-'+lead,source_url:'https://example.invalid',email:lead+'@example.test',phone:'+44 7000 0000 01',whatsapp:'+44 7000 0000 02',website_url:'https://homepage.example.test',public_contact:'https://example.test/contact',community_url:'https://example.test/community'};
  for(const labels of [{email:'邮箱',phone:'电话',whatsapp:'WhatsApp',website_url:'官网',public_contact:'公开联系',community_url:'社群',source:'来源'},{email:'Email',phone:'Phone',whatsapp:'WhatsApp',website_url:'Website',public_contact:'Contact',community_url:'Community',source:'Source'}]){
    const draft=exports.createSalesLeadCustomerDraft(item,labels),regex=vm.runInNewContext(expression,{lead:item,RegExp,String},{timeout:2000});assert.equal(draft.contactDetails.split('\n').length,6);assert(regex.test(draft.contactDetails));
  }
});

test('负责人故障只恢复本次完整版本，恢复后接纳恰好两次修订',async()=>{
  const h=conversionFixtureHarness();await h.run(async fixture=>{
    const item=fixture.create();h.state.get(item.id).proof={...good,source_id:item.manifest.sourceId,lead_name:item.name,customer_notes:item.manifest.notes};
    fixture.confirm(item);const other=fixture.otherSalesman();fixture.replaceOwner(item,owner,other);assert(item.ownerFault);
    fixture.replaceOwner(item,other,owner);assert.equal(item.ownerFault,undefined);assert.equal(fixture.confirm(item).customer_revision,3);
  });assert.equal(h.events.filter(e=>e==='owner-write').length,2);
});

test('负责人故障后出现他处修改，恢复在SQL前拒绝且不接纳未知版本',async()=>{
  const h=conversionFixtureHarness();await h.run(async fixture=>{
    const item=fixture.create();h.state.get(item.id).proof={...good,source_id:item.manifest.sourceId,lead_name:item.name,customer_notes:item.manifest.notes};
    fixture.confirm(item);const other=fixture.otherSalesman();fixture.replaceOwner(item,owner,other);
    const external={...h.state.get(item.id).proof,customer_notes:'其他维护修改',customer_revision:3};h.state.get(item.id).proof=external;
    assert.throws(()=>fixture.replaceOwner(item,other,owner));assert.deepEqual(h.state.get(item.id).proof,external);assert.equal(item.manifest.customerRevision,1);
  });assert.equal(h.events.filter(e=>e==='owner-write').length,1);
});
