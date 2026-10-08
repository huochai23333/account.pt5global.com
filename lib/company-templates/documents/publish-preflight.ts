import { documentBridge } from "./frame-bridge";
import { validateHtmlFile } from "../validation";
/** 在与正式模板相同的隔离窗口内运行真实导出/恢复；检查失败或超时不会发送发布请求。 */
export async function verifyTemplateSaveProtocol(file: File) {
  const validated=await validateHtmlFile(file);if(!validated)throw new Error("company_template_file_required");
  const html=validated.content;const token=crypto.randomUUID();
  const frame=document.createElement("iframe");frame.hidden=true;
  frame.setAttribute("sandbox","allow-scripts");
  const policy="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data: blob: http: https:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  // CSP meta 是首个 head 元素，不能让上传 HTML 在检查期间装载外部程序。
  const parsed=new DOMParser().parseFromString(html,"text/html");
  const meta=parsed.createElement("meta");meta.httpEquiv="Content-Security-Policy";meta.content=policy;parsed.head.prepend(meta);
  frame.srcdoc=documentBridge(`<!doctype html>${parsed.documentElement.outerHTML}`,token,window.location.origin);
  return new Promise<void>((resolve,reject)=>{
    function cleanup(){clearTimeout(timer);window.removeEventListener("message",message);frame.remove();}
    function message(event:MessageEvent){
      if(event.source!==frame.contentWindow||event.origin!=="null"||event.data?.token!==token)return;
      if(event.data.type==="pt5.document.boot")frame.contentWindow?.postMessage({type:"pt5.document.initialize",token,state:{}},"*");
      if(event.data.type==="pt5.document.ready"){cleanup();resolve();}
      if(event.data.type==="pt5.document.error"){cleanup();reject(new Error("company_template_save_protocol_invalid"));}
    }
    const timer=setTimeout(()=>{cleanup();reject(new Error("company_template_save_protocol_invalid"));},15000);
    window.addEventListener("message",message);document.body.appendChild(frame);
  });
}
