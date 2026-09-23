// VM 边界需要按路径装入真实源码，因此这里使用 CommonJS 并局部关闭脚本文件的导入风格规则。
/* eslint-disable @typescript-eslint/no-require-imports, @next/next/no-assign-module-variable */
// 用临时本机 HTTP 服务和全新浏览器上下文验证模板响应边界，仅使用合成标记。
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const assert = require('node:assert/strict');
// 默认使用仓库根目录，仍允许在独立审计环境显式传入另一份源码位置。
const root = process.argv[2] || path.resolve(__dirname, '..');
const ts = require(path.join(root, 'node_modules/typescript'));
const { chromium } = require(path.join(root, 'node_modules/@playwright/test'));
function load(relative, dependencies) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInThisContext('(function(require,module,exports){' + output + '\n})')((name) => {
    if (!Object.hasOwn(dependencies, name)) throw new Error('未隔离的依赖：' + name);
    return dependencies[name];
  }, module, module.exports);
  return module.exports;
}
const document = `<html><body><script>try { document.body.dataset.probe = JSON.stringify({ storage: localStorage.getItem('pt5-audit-canary'), cookie: document.cookie }); } catch(error) { document.body.dataset.probe = error.name; }</script></body></html>`;
const route = load('app/api/company-templates/[templateId]/content/route.ts', {
  '@/lib/company-templates/repository': { getCompanyTemplateDocument: async () => ({ content: document, hash: 'synthetic' }) },
  '@/lib/company-templates/access': { requireCompanyTemplateApiAccess: async () => ({ isAdmin: false }) },
  '@/lib/supabase-server': { getServerSupabaseClient: async () => ({}) },
});
const validation = load('lib/company-templates/validation.ts', {});
async function main() {
  await validation.validateHtmlFile(new File([document], 'audit.html', { type: 'text/html' }));
  const server = http.createServer(async (req, res) => {
    if (req.url === '/template') {
      const response = await route.GET(new Request('http://127.0.0.1/template'), { params: Promise.resolve({ templateId: 'synthetic-id' }) });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    } else {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body>Isolated audit fixture</body></html>');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    const installedChrome = process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : undefined;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || installedChrome });
    const page = await browser.newPage();
    const origin = 'http://127.0.0.1:' + server.address().port;
    await page.goto(origin);
    await page.evaluate(() => { localStorage.setItem('pt5-audit-canary', 'synthetic-value'); document.cookie = 'audit_cookie=synthetic; path=/'; });
    await page.goto(origin + '/template');
    const result = await page.locator('body').getAttribute('data-probe');
    // 内容脚本仍可执行，但沙箱来源不能读登录站点的 localStorage 和 Cookie。
    assert.equal(result, 'SecurityError');
    const headers = await page.request.get(origin + '/template');
    assert.match(headers.headers()['content-security-policy'], /sandbox allow-scripts/);
    assert.doesNotMatch(headers.headers()['content-security-policy'], /allow-same-origin/);
    console.log(JSON.stringify({ validationAccepted: true, topLevelTemplateStorageBlocked: true, responseSandbox: true }, null, 2));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
