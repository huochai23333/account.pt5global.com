import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as policy from '../lib/public-site-origin-policy.ts';

// 执行真实正文路由与地址策略；仅替换账号和文档读取，重现托管平台内部 URL 与公开域名不同的情况。
function load(path, dependencies, environment = {}) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  runInNewContext(source, { exports, process: { env: environment }, Request, Response, URL, Headers,
    require(name) { if (!(name in dependencies)) throw Error('Unexpected module ' + name); return dependencies[name]; } });
  return exports;
}
for (const production of [true, false]) {
  test(production ? '生产文档握手使用公开域名，拒绝内部地址和伪造转发头' : '开发文档握手使用明确的本机端口', async () => {
    const origin = production ? 'https://account.pt5global.com' : 'http://localhost:3100';
    const environment = { NODE_ENV: production ? 'production' : 'development' };
    const publicOrigin = load('../lib/public-site-origin.ts', {
      './company-config': { companyConfig: { defaultPublicOrigin: 'https://account.pt5global.com' }, getCompanyPublicOrigin: () => 'https://account.pt5global.com' },
      './public-site-origin-policy': policy,
    }, environment);
    // 通用采集层也使用真实实现，仅加载函数定义；这里不运行浏览器表单恢复。
    const adapter = load('../lib/company-templates/documents/generic-adapter.ts', {});
    const bridge = load('../lib/company-templates/documents/frame-bridge.ts', {'./generic-adapter': adapter});
    const route = load('../app/api/company-template-documents/[documentId]/content/route.ts', {
      '@/lib/public-site-origin': publicOrigin,
      '@/lib/company-templates/documents/api': { documentAccess: async () => ({}), documentFailure: () => new Response('failed', { status: 500 }) },
      '@/lib/company-templates/documents/repository': { readTemplateDocument: async () => ({ id: 'probe', location: {can_manage: true} }), readDocumentHtml: async () => '<html><body>Document</body></html>' },
      '@/lib/company-templates/documents/frame-bridge': bridge,
      '@/lib/company-templates/content-security': { TEMPLATE_CONTENT_SECURITY_POLICY: "sandbox allow-scripts; connect-src 'none'" },
      '@/lib/company-templates/frame-document': { addCompanyTemplateReadySignal: html => html },
    });
    const request = new Request('https://0.0.0.0:3000/api/company-template-documents/probe/content?loadToken=11111111-1111-4111-8111-111111111111', {
      headers: { host: '0.0.0.0:3000', 'x-forwarded-host': production ? 'evil.example.com' : 'localhost:3100' },
    });
    const response = await route.GET(request, { params: Promise.resolve({ documentId: 'probe' }) });
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes('"parentOrigin":' + JSON.stringify(origin)));
    assert.ok(!html.includes('"parentOrigin":"https://0.0.0.0:3000"'));
    assert.match(response.headers.get('content-security-policy'), /sandbox allow-scripts/);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
  });
}
