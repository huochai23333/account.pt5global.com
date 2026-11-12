import {randomUUID} from 'node:crypto';
import {startLogisticsSourceServer} from '../../test-support/logistics-source-server';
import {createLogisticsFixtureStore} from '../../test-support/logistics-fixture-store';
export {fixtureSqlValue} from '../../test-support/logistics-fixture-sql';

/** 夹具只进入完整专属API/DB实例；私有备份保存原配置，宿主机不读取/打印原密钥。 */
export async function startLogisticsSourceFixture(){
  const store=createLogisticsFixtureStore(),token=randomUUID(),operationIds=new Set<string>();
  let source: Awaited<ReturnType<typeof startLogisticsSourceServer>>|undefined;
  async function close(){
    const errors: unknown[]=[];
    try{if(source){await source.close();if(source.errors.length)throw new Error('logistics_fixture_source_errors');}}catch(error){errors.push(error);}
    try{store.restore(token,[...operationIds]);}catch(error){errors.push(error);}
    if(errors.length)throw new AggregateError(errors,'logistics_fixture_cleanup_failed');
  }
  try{
    // 准备先提交并独立核对，再启动来源服务；监听失败也走同一限定恢复路径。
    store.prepare(token);source=await startLogisticsSourceServer();
    return {calls:source.calls,apiUrl:store.apiUrl,recover:source.recover,close,
      readRows:store.readRows,execute:store.execute,
      recordOperation(value: unknown){
        if(typeof value!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value))
          throw new Error('logistics_fixture_operation_id_missing');
        operationIds.add(value);
      }};
  }catch(error){
    try{await close();}catch(cleanupError){throw new AggregateError([error,cleanupError],'logistics_fixture_prepare_and_cleanup_failed');}
    throw error;
  }
}
