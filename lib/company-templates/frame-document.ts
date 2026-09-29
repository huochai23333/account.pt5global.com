import { COMPANY_TEMPLATE_READY } from "./frame-protocol";

/**
 * 只有正文鉴权、版本读取和原始 HTML 哈希核对全部通过后才添加就绪脚本。
 * 错误响应没有这段脚本，因此 iframe 的 load 不能把错误文档伪装成可用模板。
 * 标识只接受 UUID，不拼接任意查询文本，原始内容及数据库哈希保持原值。
 */
export function addCompanyTemplateReadySignal(content: string, token: string | null) {
  if (!token || !/^[a-f0-9-]{36}$/i.test(token)) return content;
  const message = JSON.stringify({ type: COMPANY_TEMPLATE_READY, token });
  const bridge = `<script>window.addEventListener('load',function(){window.parent.postMessage(${message},'*');},{once:true});</script>`;
  // 直接追加脚本，浏览器会把尾部脚本解析到当前文档中。
  // 不搜索或改写结束标签，避免误改打印脚本、字符串或注释里的 HTML 片段。
  return `${content}${bridge}`;
}
