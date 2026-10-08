import { documentBridge } from "./frame-bridge";
import { validateHtmlFile } from "../validation";
import { addCompanyTemplateReadySignal } from "../frame-document";
import { isCompanyTemplateReadyMessage } from "../frame-protocol";
/** 原文件只用于校验，不改写上传内容。普通 HTML 检查打开；自带保存能力时额外检查恢复往返。 */
export async function verifyTemplateUsability(file: File) {
  const validated=await validateHtmlFile(file);if(!validated)throw new Error("company_template_file_required");
  const html=validated.content;const token=crypto.randomUUID();
  const saving=html.includes("PT5Template");
  const failure=saving?"company_template_save_protocol_invalid":"company_template_open_check_failed";
  const frame=document.createElement("iframe");frame.hidden=true;
  frame.setAttribute("sandbox","allow-scripts");
  const policy="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob: http: https:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  // CSP meta 是首个 head 元素，不能让上传 HTML 在检查期间装载外部程序。
  const parsed=new DOMParser().parseFromString(html,"text/html");
  // 在模板脚本运行前监听初始化异常，只发送固定失败标识，不把内部异常显示给员工。
  const guard=parsed.createElement("script");
  guard.textContent=`window.addEventListener('error',function(){parent.postMessage({type:'pt5.template.preflight-error',token:${JSON.stringify(token)}},'*');});window.addEventListener('unhandledrejection',function(){parent.postMessage({type:'pt5.template.preflight-error',token:${JSON.stringify(token)}},'*');});`;
  parsed.head.prepend(guard);
  const meta=parsed.createElement("meta");meta.httpEquiv="Content-Security-Policy";meta.content=policy;parsed.head.prepend(meta);
  const preview=`<!doctype html>${parsed.documentElement.outerHTML}`;
  frame.srcdoc=saving?documentBridge(preview,token,window.location.origin):addCompanyTemplateReadySignal(preview,token);
  return new Promise<void>((resolve,reject)=>{
    function cleanup(){clearTimeout(timer);window.removeEventListener("message",message);frame.remove();}
    function message(event:MessageEvent){
      if(event.source!==frame.contentWindow||event.origin!=="null"||event.data?.token!==token)return;
      if(event.data.type==="pt5.template.preflight-error"){cleanup();reject(new Error(failure));return;}
      if(!saving&&isCompanyTemplateReadyMessage(event.data,token)){cleanup();resolve();return;}
      if(event.data.type==="pt5.document.boot")frame.contentWindow?.postMessage({type:"pt5.document.initialize",token,state:{}},"*");
      if(event.data.type==="pt5.document.ready"){cleanup();resolve();}
      if(event.data.type==="pt5.document.error"){cleanup();reject(new Error(failure));}
    }
    const timer=setTimeout(()=>{cleanup();reject(new Error(failure));},15000);
    window.addEventListener("message",message);document.body.appendChild(frame);
  });
}
