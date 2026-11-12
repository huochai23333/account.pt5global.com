import {createServer} from "node:http";

/** 只模拟外部来源；真实Worker仍处理请求、转换、重试和数据库提交。 */
export async function startLogisticsSourceServer({port=43194,host="0.0.0.0"}={}) {
  const calls: {orderId: number;at: number}[]=[],errors: string[]=[];
  let blocked=true,active=0,closing: Promise<void>|undefined;
  const server=createServer(async(request,response)=>{
    active++;
    try{
      if(request.url!=="/source"||request.headers["x-logistics-integration-token"]!=="local-fixture"){
        response.writeHead(403).end();return;
      }
      if(request.method!=="POST"){response.writeHead(405).end();return;}
      let text="";
      for await(const chunk of request){text+=chunk;if(Buffer.byteLength(text)>16384)throw new Error("fixture_request_too_large");}
      const body=JSON.parse(text),cursor=body?.cursor;
      if(!cursor||typeof cursor!=="object"||![0,9000025].includes(cursor.order_id)
        ||!["full","incremental"].includes(body.mode)||body.limit!==500)throw new Error("fixture_request_invalid");
      const orderId=cursor.order_id as number;calls.push({orderId,at:Date.now()});
      if(blocked&&orderId===9000025){
        response.writeHead(429,{"Content-Type":"application/json","Retry-After":"120"})
          .end(JSON.stringify({message:"Rate limit exceeded. Retry after 120000ms."}));return;
      }
      const start=orderId===0?1:26;
      const rows=Array.from({length:25},(_,index)=>({source_order_id:9000000+start+index,package_number:`LOCAL-RETRY-${start+index}`,
        store_name:"Local Retry Shop",order_created_at:new Date().toISOString(),tracking_number:`RETRY-TRACK-${start+index}`,
        logistics_status:"运输中",logistics_provider:"Fixture",has_tracking:true,has_shipping_cost:true,shipping_cost:10,shipping_currency:"USD"}));
      response.writeHead(200,{"Content-Type":"application/json"}).end(JSON.stringify({rows,
        next_cursor:{...cursor,order_id:9000000+start+24},has_more:start===1}));
    }catch(error){
      // async监听器的拒绝不会自动变成HTTP失败；收进明确错误列表，不能让测试进程直接退出。
      errors.push(error instanceof SyntaxError?"fixture_json_invalid":error instanceof Error?error.message:"fixture_request_failed");
      if(!response.destroyed&&!response.writableEnded)response.writeHead(400,{"Content-Type":"application/json"}).end(JSON.stringify({error:"local_fixture_invalid_request"}));
    }finally{active--;}
  });
  server.requestTimeout=5000;server.headersTimeout=5000;
  await new Promise<void>((resolve,reject)=>{server.once("error",reject);server.listen(port,host,resolve);});
  const address=server.address();if(!address||typeof address==="string")throw new Error("fixture_listen_address_missing");
  return {calls,errors,port:address.port,recover:()=>{blocked=false;},
    close(){
      // 先停止接入，再关闭本次全部连接；重复收尾复用同一结果，不因已经关闭再次失败。
      closing??=new Promise<void>((resolve,reject)=>{
        server.close(error=>error?reject(error):resolve());server.closeAllConnections();
      }).then(async()=>{
        // 断开半个请求后，异步读取还需一个事件循环完成finally；有界等待而不是提前宣称已关闭。
        for(let attempt=0;active!==0&&attempt<50;attempt++)await new Promise(resolve=>setTimeout(resolve,10));
        if(server.listening||active!==0)throw new Error("fixture_source_not_closed");
      });
      return closing;
    }};
}
