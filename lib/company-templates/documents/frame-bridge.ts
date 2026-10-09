import { installGenericTemplateAdapter } from "./generic-adapter";

/** 共用沙箱桥：原文件不变，普通模板在运行时采集数据，本站保存权限仍留在父页。 */
export function documentBridge(content: string, token: string, parentOrigin: string, readOnly = false) {
  const config = JSON.stringify({ token, parentOrigin, readOnly }).replace(/</g, "\\u003c");
  return content + `<script>(function(){
    (${installGenericTemplateAdapter.toString()})();
    var config=${config}, initialized=false,initializing=false,timer;
    function send(type,extra){parent.postMessage(Object.assign({type:'pt5.document.'+type,token:config.token},extra||{}),config.parentOrigin);}
    function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+canonical(v[k]);}).join(',')+'}';return JSON.stringify(v);}
    async function snapshot(){var value=JSON.parse(JSON.stringify(await window.PT5Template.exportState()));if(!value||typeof value!=='object'||Array.isArray(value))throw Error('state');return value;}
    window.addEventListener('message',async function(event){
      if(event.source!==parent||event.origin!==config.parentOrigin||!event.data||event.data.token!==config.token)return;
      try{
        var api=window.PT5Template;
        if(!api||api.version!==1||typeof api.exportState!=='function'||typeof api.importState!=='function'||typeof api.subscribe!=='function')throw Error('unsupported');
        if(event.data.type==='pt5.document.initialize'&&!initialized&&!initializing){
          initializing=true;
          var state=event.data.state;
          if(!state||typeof state!=='object'||Array.isArray(state))throw Error('state');
          var expected=Object.keys(state).length?state:await snapshot();
          await api.importState(expected);
          if(canonical(await snapshot())!==canonical(expected))throw Error('roundtrip');
          api.subscribe(function(){if(!initialized||config.readOnly)return;send('dirty');clearTimeout(timer);timer=setTimeout(async function(){try{send('state',{state:await snapshot()});}catch(e){send('error');}},100);});
          initialized=true;if(config.readOnly)document.body.inert=true;send('ready',{state:await snapshot()});
        }
        if(event.data.type==='pt5.document.export'&&initialized)send('state',{state:await snapshot(),requestId:event.data.requestId});
        if(event.data.type==='pt5.document.print'&&initialized&&config.readOnly)window.print();
      }catch(e){send('error',{reason:e instanceof Error?e.message:'invalid'});}
    });
    window.addEventListener('load',function(){send('boot');},{once:true});
  })();</script>`;
}
