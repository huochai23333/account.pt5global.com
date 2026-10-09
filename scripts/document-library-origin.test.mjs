import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as policy from '../lib/public-site-origin-policy.ts';

// 执行真实来源检查，模拟托管平台内部地址；不替换被测逻辑，也不连接云端账号。
function loadCheck(production, configuredOrigin = 'https://account.pt5global.com') {
  const source = ts.transpileModule(readFileSync(new URL('../lib/document-library/http.ts', import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  const dependencies = {
    'server-only': {},
    '@/lib/company-config': { companyConfig: { defaultPublicOrigin: 'https://account.pt5global.com' }, getCompanyPublicOrigin: () => configuredOrigin },
    '@/lib/public-site-origin-policy': policy,
  };
  runInNewContext(source, { exports, process: { env: { NODE_ENV: production ? 'production' : 'development' } }, Request, Response, URL, Headers,
    require(name) { if (!(name in dependencies)) throw Error('Unexpected module ' + name); return dependencies[name]; } });
  return exports.checkDocumentOrigin;
}

for (const path of ['/api/document-library', '/api/document-library/upload', '/api/document-library/reconcile']) {
  test(`正式域名经过内部地址转发仍可写入 ${path}`, () => {
    const check = loadCheck(true);
    assert.doesNotThrow(() => check(new Request(`http://0.0.0.0:3000${path}`, {
      headers: { origin: 'https://account.pt5global.com', host: '0.0.0.0:3000', 'x-forwarded-host': 'evil.example.com' },
    })));
  });
}

test('生产写入拒绝外站、空来源值、内部来源和伪造转发头', () => {
  const check = loadCheck(true);
  for (const origin of ['https://evil.example.com', 'null', 'http://0.0.0.0:3000', 'https://account.pt5global.com.evil.example.com']) {
    assert.throws(() => check(new Request('http://0.0.0.0:3000/api/document-library', {
      headers: { origin, host: 'evil.example.com', 'x-forwarded-host': 'evil.example.com' },
    })), /forbidden/);
  }
});

test('部署域名采用受校验的配置，本机开发按实际允许端口检查', () => {
  assert.doesNotThrow(() => loadCheck(true, 'https://files.pt5global.com')(new Request('http://0.0.0.0:3000/api/document-library', {
    headers: { origin: 'https://files.pt5global.com' },
  })));
  for (const host of ['localhost:3100', '127.0.0.1:3100']) {
    const check = loadCheck(false);
    assert.doesNotThrow(() => check(new Request(`http://${host}/api/document-library`, { headers: { origin: `http://${host}`, host } })));
    assert.throws(() => check(new Request(`http://${host}/api/document-library`, { headers: { origin: 'https://evil.example.com', host } })), /forbidden/);
  }
});

test('没有浏览器来源头的服务端请求沿用原来的登录与数据授权', () => {
  assert.doesNotThrow(() => loadCheck(true)(new Request('http://0.0.0.0:3000/api/document-library')));
});
