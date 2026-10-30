// 直接验证升级后的库及现有邮件清洗函数；所有数据为合成值，不访问账号、数据库或邮件服务。
/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const sanitizeHtml = require("sanitize-html");
const MailComposer = require("nodemailer/lib/mail-composer");
const sharp = require("sharp");

const filename = path.resolve(__dirname, "../lib/mail/mail-outbound-worker.ts");
const source = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const target = { exports: {} };
vm.runInThisContext(`(function(require,module,exports){${source}\nexports.cleanHtmlForTest = cleanHtml;})`, { filename })(
  (name) => {
    if (name === "sanitize-html") return sanitizeHtml;
    if (name === "nodemailer/lib/mail-composer/index.js") return MailComposer;
    // 网络和服务端能力只允许存在为不可调用边界，测试绝不加载凭据模块。
    return new Proxy({}, { get: () => () => { throw new Error("不允许访问外部边界"); } });
  }, target, target.exports,
);

test("现有邮件清洗保留正常正文与链接", () => {
  const html = target.exports.cleanHtmlForTest('<p><strong>Hello</strong> <a href="https://example.invalid/item">Item</a></p>');
  assert(html.includes("<strong>Hello</strong>")); assert(html.includes('href="https://example.invalid/item"'));
});
test("现有邮件清洗拒绝脚本、刷新跳转、SVG 动画及事件处理器", () => {
  const html = target.exports.cleanHtmlForTest('<p onclick="alert(1)">Safe</p><script>alert(1)</script><meta http-equiv="refresh" content="0;url=javascript:alert(1)"><svg><animate attributeName="href" values="javascript:alert(1)"></animate></svg><a href="javascript:alert(1)">Link</a>');
  assert(html.includes("Safe")); assert(html.includes("Link"));
  assert(!/javascript:|onclick|<script|<meta|<svg|<animate/i.test(html));
});
test("邮件构建得到明确收件人集合，密送不会泄露到邮件头", async () => {
  const message = new MailComposer({ from: '"PT5 Test" <sender@example.invalid>',
    to: '"Customer (test)" <to@example.invalid>', cc: "cc@example.invalid", bcc: "hidden@example.invalid",
    subject: "Synthetic only", html: "<p>Hello</p>" }).compile();
  assert.deepEqual(message.getEnvelope().to.sort(), ["cc@example.invalid", "hidden@example.invalid", "to@example.invalid"]);
  const raw = (await message.build()).toString("utf8");
  assert(!/^Bcc:/im.test(raw)); assert(!raw.includes("hidden@example.invalid"));
});
test("sharp 的本机二进制能够读取并转换实际图片", async () => {
  const input = await sharp({ create: { width: 40, height: 20, channels: 4,
    background: { r: 30, g: 80, b: 120, alpha: 1 } } }).png().toBuffer();
  const output = await sharp(input).resize(20).webp().toBuffer();
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 20); assert.equal(metadata.height, 10);
});
