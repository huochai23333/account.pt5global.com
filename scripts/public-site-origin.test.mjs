import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import * as policy from "../lib/public-site-origin-policy.ts";
import { getMailReturnPath, getSafeMailReturnUrl } from "../lib/mail/mail-return-url.ts";
import { getFeishuConnectionFeedback } from "../lib/mail/mail-feishu-feedback.ts";

const DEFAULT = "https://account.pt5global.com";
const CUSTOM = "https://portal.pt5global.com";

for (const value of [undefined, "", "account.pt5global.com", "http://account.pt5global.com", "https://account.pt5global.com:3000", "https://0.0.0.0:3000", "https://127.1", "https://0x7f000001", "https://192.168.1.2", "https://8.8.8.8", "https://[::1]", "https://[2001:4860:4860::8888]", "https://localhost", "https://localhost:3000", "https://app.local", "https://app.internal", "https://app.home.arpa", "https://node", "https://user:password@account.pt5global.com", "https://account.pt5global.com/path", "https://account.pt5global.com?next=x", "https://account.pt5global.com#part", "https://account.pt5global.com\\"] ) {
  test(`生产配置拒绝非公开根地址：${value ?? "未配置"}`, () => {
    assert.equal(policy.resolveConfiguredPublicOrigin(value, DEFAULT, true).origin, DEFAULT);
    assert.ok(policy.resolveConfiguredPublicOrigin(value, DEFAULT, true).reason);
  });
}

test("公开配置保留自定义域名并归一化标准端口", () => {
  assert.deepEqual(policy.resolveConfiguredPublicOrigin(`${CUSTOM}:443/`, DEFAULT, true), { origin: CUSTOM, reason: null });
});

test("本地及测试保留域名不能作为正式地址", () => {
  for (const suffix of ["localdomain", "lan", "home", "test", "invalid", "example"]) {
    assert.equal(policy.resolveConfiguredPublicOrigin(`https://app.${suffix}`, DEFAULT, true).origin, DEFAULT);
  }
});

for (const host of [null, "0.0.0.0:3000", "localhost:3000", "127.0.0.1:3000", "evil.example.com", "localhost:3000, account.pt5global.com", "account.pt5global.com, localhost:3000"]) {
  test(`生产请求忽略转发来源：${host ?? "缺失"}`, () => {
    const headers = new Headers({ host: "0.0.0.0:3000" });
    if (host) headers.set("x-forwarded-host", host);
    assert.equal(policy.resolveRequestPublicOrigin(headers, CUSTOM, DEFAULT, true), CUSTOM);
  });
}

test("本地支持 localhost 与 127.0.0.1，未知域名仍不能改变来源", () => {
  for (const host of ["localhost:3000", "127.0.0.1:3001"]) {
    assert.equal(policy.resolveConfiguredPublicOrigin(`http://${host}`, DEFAULT, false).origin, `http://${host}`);
    assert.equal(policy.resolveRequestPublicOrigin(new Headers({ host }), DEFAULT, DEFAULT, false), `http://${host}`);
  }
  assert.equal(policy.resolveRequestPublicOrigin(new Headers({ "x-forwarded-host": "evil.example.com" }), CUSTOM, DEFAULT, false), CUSTOM);
  assert.equal(policy.resolveRequestPublicOrigin(new Headers({ "x-forwarded-host": "account.pt5global.com, localhost:3000" }), CUSTOM, DEFAULT, false), DEFAULT);
});

test("生产告警去重且不包含配置值", () => {
  const warnings = [];
  const environment = { NODE_ENV: "production", NEXT_PUBLIC_SITE_URL: "https://private-user:private-password@localhost:3000" };
  // 执行真实公司配置模块；只替换模块加载边界，以便捕获服务端告警而不改变测试进程环境。
  const source = ts.transpileModule(readFileSync(new URL("../lib/company-config.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports = {};
  runInNewContext(source, { exports, require: () => policy, process: { env: environment }, console: { warn: (...values) => warnings.push(values) } });
  assert.equal(exports.getCompanyPublicOrigin(), DEFAULT);
  assert.equal(exports.getCompanyPublicOrigin(), DEFAULT);
  assert.equal(warnings.length, 1);
  assert.equal(JSON.stringify(warnings).includes("private-"), false);
  environment.NEXT_PUBLIC_SITE_URL = undefined;
  exports.getCompanyPublicOrigin();
  assert.equal(warnings.length, 2);
});

test("授权返回只允许当前角色邮件页，并清除伪造结果", () => {
  for (const role of ["administrator", "salesman"]) for (const provider of ["google", "feishu"]) {
    const expected = DEFAULT + getMailReturnPath(provider, role);
    for (const value of [null, "https://0.0.0.0:3000/admin/mail", "http://localhost:3000/salesman/mail", "//outside.example/mail", "/\\outside.example/mail", "/admin/home", "/admin/mail", "/salesman/mail", expected + "?mailConnection=success#forged"]) {
      assert.equal(getSafeMailReturnUrl(value, DEFAULT, provider, role), expected);
    }
  }
});

test("飞书提示只接受失败与固定原因，不信任成功参数或任意异常文字", () => {
  assert.equal(getFeishuConnectionFeedback({ feishuConnection: "success" }), null);
  assert.equal(getFeishuConnectionFeedback({ feishuConnection: "failed", feishuReason: "NEXT_REDIRECT" }), "unavailable");
  assert.equal(getFeishuConnectionFeedback({ feishuConnection: "failed", feishuReason: "cancelled" }), "cancelled");
  assert.equal(getFeishuConnectionFeedback({ feishuConnection: "failed", feishuReason: ["state"] }), "unavailable");
});
