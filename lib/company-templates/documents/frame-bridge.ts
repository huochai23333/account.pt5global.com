/** 共用沙箱桥：模板仅提供数据接口，本站账号与保存权限留在父页。 */
export function documentBridge(content: string, token: string, parentOrigin: string) {
  const config = JSON.stringify({ token, parentOrigin }).replace(/</g, "\\u003c");
  return content + `<script>(function(){
    var config=${config}, initialized=false,timer;
    function send(type,extra){parent.postMessage(Object.assign({type:'pt5.document.'+type,token:config.token},extra||{}),config.parentOrigin);}
    function canonical(v){if(Array.isArray(v))return '['+v.map(canonical).join(',')+']';if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+canonical(v[k]);}).join(',')+'}';return JSON.stringify(v);}
    function snapshot(){var value=JSON.parse(JSON.stringify(window.PT5Template.exportState()));if(!value||typeof value!=='object'||Array.isArray(value))throw Error('state');return value;}
    window.addEventListener('message',function(event){
      if(event.source!==parent||event.origin!==config.parentOrigin||!event.data||event.data.token!==config.token)return;
      try{
        var api=window.PT5Template;
        if(!api||api.version!==1||typeof api.exportState!=='function'||typeof api.importState!=='function'||typeof api.subscribe!=='function')throw Error('unsupported');
        if(event.data.type==='pt5.document.initialize'&&!initialized){
          var state=event.data.state;
          if(!state||typeof state!=='object'||Array.isArray(state))throw Error('state');
          var expected=Object.keys(state).length?state:snapshot();
          api.importState(expected);
          if(canonical(snapshot())!==canonical(expected))throw Error('roundtrip');
          api.subscribe(function(){if(!initialized)return;send('dirty');clearTimeout(timer);timer=setTimeout(function(){try{send('state',{state:snapshot()});}catch(e){send('error');}},100);});
          initialized=true;send('ready',{state:snapshot()});
        }
        if(event.data.type==='pt5.document.export'&&initialized)send('state',{state:snapshot(),requestId:event.data.requestId});
      }catch(e){send('error',{reason:e instanceof Error?e.message:'invalid'});}
    });
    window.addEventListener('load',function(){send('boot');},{once:true});
  })();</script>`;
}
