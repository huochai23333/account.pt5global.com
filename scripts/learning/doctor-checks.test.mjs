import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { runInNewContext } from "node:vm";
import {
  chooseNpmVersion,
  describeConfiguration,
  isLocalEndpoint,
  isLocalJobEndpoint,
  parseEnvironment,
  hasKnownGatewayReuseRisk,
  isDeclaredLocalAuthUrl,
  isDeclaredLocalAuthCallbackUrl,
} from "./doctor-checks.mjs";

/** 执行真实维护命令，只有 Docker 与备份文件端口替换；测试不触碰运行中的网关。 */
export function runGatewayRepair({ pool = 0, active = false, apply = false, missingTemplate = false, brokenReload = false } = {}, source) {
  const script = fileURLToPath(new URL("../../../PT5-dropshipping-supabase/scripts/repair-local-gateway.mjs", import.meta.url));
  const messages = [], errors = [], backups = [], reloads = [];
  const state = { pool, active };
  const execFileSync = (command, args) => {
    assert.equal(command, "docker");
    if (args[0] === "inspect") return "pt5-dropshipping";
    if (args.includes("--version")) return "PostgREST 14.5";
    if (args.includes("cat")) {
      if (args.at(-1) === "/home/kong/custom_nginx.template") return missingTemplate ? "http {}" : "http { server { listen 8088; } }";
      if (args.at(-1) === "/usr/local/kong/nginx.conf") return state.active ? "listen 8088;" : "listen 8000;";
    }
    if (args.some(value => value.includes("sed -n"))) return String(state.pool);
    if (args.includes("psql")) return "0";
    if (args.includes("reload")) {
      assert.equal(args.at(-2), "--nginx-conf");
      assert.equal(args.at(-1), "/home/kong/custom_nginx.template");
      state.pool = Number(args.find(value => value.startsWith("KONG_UPSTREAM_KEEPALIVE_POOL_SIZE=")).split("=")[1]);
      state.active = !brokenReload;
      reloads.push({ ...state });
      return "";
    }
    throw Error("测试不允许未知 Docker 操作");
  };
  const process = { argv: ["node", script, ...(apply ? ["--apply"] : [])], exitCode: 0 };
  const text = (source ?? fs.readFileSync(script, "utf8")).replace(/^import .+;\r?$/gm, "").replaceAll("import.meta.dirname", "fixtureDirectory");
  runInNewContext(text, { assert, path, createHash, execFileSync, process, fixtureDirectory: path.dirname(script),
    fs: { mkdirSync() {}, writeFileSync(file, body) { backups.push({ file, body: JSON.parse(body) }); } },
    console: { log(value) { messages.push(JSON.parse(value)); }, error(value) { errors.push(value); } } });
  return { messages, errors, backups, reloads, state, exitCode: process.exitCode };
}

test("网关连接池已为零但邮件监听缺失时，预览仍要求修复", () => {
  const result = runGatewayRepair();
  assert.equal(result.messages[0].mode, "preview");
  assert.equal(result.messages[0].mailTemplateActive, false);
  assert.equal(result.reloads.length, 0);
});
test("缺少邮件监听时显式应用会加载原模板且保留连接池为零", () => {
  const result = runGatewayRepair({ apply: true });
  assert.equal(result.exitCode, 0);
  assert.equal(result.reloads.length, 1);
  assert.deepEqual(result.state, { pool: 0, active: true });
  assert.equal(result.messages[0].templatePreserved, true);
});
test("连接池与邮件监听均正确时重复应用不重载", () => {
  const result = runGatewayRepair({ apply: true, active: true });
  assert.equal(result.messages[0].mode, "already-fixed");
  assert.equal(result.reloads.length, 0);
});
test("原连接复用问题仍能同时修复且保留邮件模板", () => {
  const result = runGatewayRepair({ apply: true, pool: 60, active: true });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.state, { pool: 0, active: true });
  assert.equal(result.backups[0].body.pool, 60);
});
test("源模板缺失时拒绝重载", () => {
  const result = runGatewayRepair({ apply: true, missingTemplate: true });
  assert.equal(result.exitCode, 1);
  assert.equal(result.reloads.length, 0);
});
test("重载后监听仍缺失时拒绝成功并恢复原连接池数值", () => {
  const result = runGatewayRepair({ apply: true, pool: 60, brokenReload: true });
  assert.equal(result.exitCode, 1);
  assert.equal(result.reloads.length, 2);
  assert.equal(result.state.pool, 60);
  assert.equal(result.messages.length, 0);
});

test("邮件验证路径覆盖外部地址时，必须独立识别旧端口和错误路径", () => {
  assert.equal(isDeclaredLocalAuthCallbackUrl("http://127.0.0.1:48021/auth/v1/verify", 48021), true);
  assert.equal(isDeclaredLocalAuthCallbackUrl("http://127.0.0.1:54321/auth/v1/verify", 48021), false);
  assert.equal(isDeclaredLocalAuthCallbackUrl("http://127.0.0.1:48021/auth/v1", 48021), false);
  assert.equal(isDeclaredLocalAuthCallbackUrl(undefined, 48021), false);
});

test("Auth健康不能掩盖邮件链接仍指向旧端口、远端或不完整地址", () => {
  assert.equal(isDeclaredLocalAuthUrl("http://127.0.0.1:48021/auth/v1", 48021), true);
  assert.equal(isDeclaredLocalAuthUrl("http://localhost:48021/auth/v1", 48021), true);
  for (const value of [undefined, "http://127.0.0.1:54321/auth/v1", "https://remote.invalid/auth/v1",
    "http://user:secret@localhost:48021/auth/v1", "http://localhost:48021", "http://localhost:48021/auth/v1?key=synthetic"])
    assert.equal(isDeclaredLocalAuthUrl(value, 48021), false);
});

test("旧 PostgREST 的连接复用风险不能被健康容器或缺失配置掩盖", () => {
  assert.equal(hasKnownGatewayReuseRisk("PostgREST 14.5", "60"), true);
  assert.equal(hasKnownGatewayReuseRisk("PostgREST 14.10", null), true);
  assert.equal(hasKnownGatewayReuseRisk("PostgREST 14.5", ""), true);
  assert.equal(hasKnownGatewayReuseRisk("PostgREST 14.5", "0"), false);
  assert.equal(hasKnownGatewayReuseRisk("PostgREST 14.15", "60"), false);
});

test("诊断配置报告不会包含合成密钥值", () => {
  const values = parseEnvironment(
    'NEXT_PUBLIC_SUPABASE_URL="http://localhost:54321"\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=synthetic-secret # comment',
  );
  assert.equal(values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "synthetic-secret");
  assert(
    !JSON.stringify(describeConfiguration(values)).includes("synthetic-secret"),
  );
  assert(describeConfiguration(values).every((entry) => entry.present));
});
test("诊断拒绝远端、伪本地域名、凭据地址和非 HTTP 协议", () => {
  for (const value of [
    "https://remote.invalid",
    "http://localhost.example.com",
    "http://user:pass@localhost",
    "file:///tmp/test",
    "https://localhost",
    "bad",
  ]) {
    assert.equal(isLocalEndpoint(value), false);
  }
  for (const value of [
    "http://localhost:54321",
    "http://127.0.0.1",
    "http://[::1]:54321",
  ])
    assert.equal(isLocalEndpoint(value), true);
});

test("npx 实际执行的 npm 版本优先于外层继承的提示", () => {
  assert.equal(
    chooseNpmVersion("11.16.0", "npm/11.13.0 node/v24.17.0"),
    "11.16.0",
  );
  assert.equal(
    chooseNpmVersion(undefined, "npm/11.13.0 node/v24.17.0"),
    "11.13.0",
  );
  assert.equal(chooseNpmVersion(undefined, undefined), null);
});

test("后台任务拒绝云端、其他项目端口、冒名网关和携带凭据的地址", () => {
  assert(
    isLocalJobEndpoint(
      "http://supabase_kong_pt5-dropshipping:8000/functions/v1/user-media-image-review",
    ),
  );
  for (const url of [
    "http://localhost:54321/functions/v1/media",
    "http://127.0.0.1:54321/functions/v1/media",
    "http://[::1]:54321/functions/v1/media",
    "http://host.docker.internal:54321/functions/v1/media",
  ])
    assert.equal(isLocalJobEndpoint(url, "54321"), true);
  for (const url of [
    "https://cloud.supabase.co/functions/v1/media",
    "http://supabase_kong_other:8000/functions/v1/media",
    "http://localhost.example.com/functions/v1/media",
    "http://u:p@localhost:54321/functions/v1/media",
    "http://localhost:55321/functions/v1/media",
    "http://127.0.0.1:56321/functions/v1/media",
    "http://[::1]:57321/functions/v1/media",
  ]) {
    assert.equal(isLocalJobEndpoint(url, "54321"), false);
  }
  // 新声明端口生效后，旧端口必须拒绝，不能同时放行两套项目地址。
  assert.equal(isLocalJobEndpoint("http://localhost:48021/functions/v1/media", "48021"), true);
  assert.equal(isLocalJobEndpoint("http://localhost:54321/functions/v1/media", "48021"), false);
  assert.equal(isLocalJobEndpoint("http://localhost:48021/functions/v1/media"), false);
});
