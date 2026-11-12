import { createHash } from "node:crypto";

/** 专属合成 HTML 与上传载荷，不读取环境或账号。 */
export function htmlFile(name: string, content: string | Buffer) {
  return {
    buffer: Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8"),
    mimeType: "text/html",
    name,
  };
}

export function publishMultipart(input: {
  expectedRevision?: string;
  guideFileValue?: ReturnType<typeof htmlFile>;
  html?: string;
  htmlFileValue?: ReturnType<typeof htmlFile>;
  slug: string;
  templateId: string;
  versionId: string;
}) {
  const multipart: Record<string, string | ReturnType<typeof htmlFile>> = {
    description: "Playwright API 回归",
    expectedRevision: input.expectedRevision ?? "",
    name: "Playwright API template",
    slug: input.slug,
    templateId: input.templateId,
    versionId: input.versionId,
  };
  const html =
    input.htmlFileValue ??
    (input.html ? htmlFile("template.html", input.html) : undefined);
  if (html) multipart.htmlFile = html;
  if (input.guideFileValue) multipart.guideFile = input.guideFileValue;
  return multipart;
}

export function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** 合成互动模板也必须实现新发布契约；只记录其测试交互涉及的两个值。 */
export function withDocumentProtocol(html: string) {
  return (
    html +
    `<script>window.PT5Template={version:1,exportState:function(){return {clicked:document.body.dataset.clicked||'',result:document.getElementById('result')?.textContent||''};},importState:function(s){document.body.dataset.clicked=s.clicked;var p=document.getElementById('result');if(p)p.textContent=s.result;},subscribe:function(fn){document.addEventListener('click',fn);return function(){document.removeEventListener('click',fn);};}};</script>`
  );
}
