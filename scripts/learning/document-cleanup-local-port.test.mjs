import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { createLocalDocumentCleanupPort } from "../document-cleanup-local-port.mjs";
import { runDocumentCleanup } from "../../../PT5-dropshipping-supabase/supabase/functions/_shared/document-cleanup.ts";
import { requireDisposableFixture, readDisposablePostgresTarget } from "../../tests/test-support/disposable-fixture.ts";

/** 真实 SDK 与清理引擎运行，HTTP 传输由内存应答；不连接 Auth、Storage 或数据库。 */
function fixture({ present = false, listError = false, noRemoveEffect = false, zeroFinish = false } = {}) {
  const calls = [];
  const target = { id: "owned-file", operation_id: "owned-operation", actor_id: "owned-actor", storage_path: "owned/receipt.txt", action: "delete_file" };
  const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  const admin = createClient("http://127.0.0.1:54321", "synthetic-local-cleanup-key", {
    auth: { persistSession: false },
    global: { fetch: async (input, init) => {
      const url = new URL(typeof input === "string" ? input : input.url);
      const method = init?.method ?? "GET";
      calls.push({ path: url.pathname, method });
      if (url.pathname.endsWith("/rpc/document_library_claim_cleanup")) return json([target]);
      if (url.pathname.endsWith("/rpc/document_library_finish")) return json({ status: "succeeded", affectedCount: zeroFinish ? 0 : 1, record: { id: target.id } });
      if (method === "HEAD") return new Response(null, { status: 400 });
      if (url.pathname === "/storage/v1/object/list/document-library") {
        assert.deepEqual(JSON.parse(init.body), { prefix: "owned", limit: 100, offset: 0, sortBy: { column: "name", order: "asc" }, search: "receipt.txt" });
        if (listError) return json({ message: "listing refused" }, 400);
        return json(present ? [{ id: "real-object-id", name: "receipt.txt" }] : []);
      }
      if (method === "DELETE" && url.pathname === "/storage/v1/object/document-library") {
        assert.deepEqual(JSON.parse(init.body), { prefixes: [target.storage_path] });
        if (!noRemoveEffect) present = false;
        return json([{ name: target.storage_path }]);
      }
      throw new Error("unexpected synthetic cleanup request");
    } },
  });
  return { admin, calls, target };
}

test("本地清理：旧 HEAD 400 缺失误判可复现，成功目录读取后才完成登记", async () => {
  const old = fixture();
  const oldPort = createLocalDocumentCleanupPort(old.admin);
  oldPort.exists = path => old.admin.storage.from("document-library").exists(path);
  const before = await runDocumentCleanup(oldPort);
  assert.equal(before.status, "failed");
  assert.equal(old.calls.filter(c => c.path.endsWith("/document_library_finish")).length, 0);
  const next = fixture();
  const after = await runDocumentCleanup(createLocalDocumentCleanupPort(next.admin));
  assert.deepEqual(after, { status: "succeeded", completed: [next.target.id], failed: [], expectedCount: 1 });
});

test("本地清理：存在对象先删除，再经第二次目录读取确认缺失", async () => {
  const f = fixture({ present: true });
  assert.equal((await runDocumentCleanup(createLocalDocumentCleanupPort(f.admin))).status, "succeeded");
  assert.equal(f.calls.filter(c => c.method === "DELETE").length, 1);
  assert.equal(f.calls.filter(c => c.path.includes("/object/list/")).length, 2);
});

test("本地清理：目录读取 400 不得完成删除登记", async () => {
  const f = fixture({ listError: true });
  assert.equal((await runDocumentCleanup(createLocalDocumentCleanupPort(f.admin))).status, "failed");
  assert.equal(f.calls.filter(c => c.method === "DELETE" || c.path.endsWith("/document_library_finish")).length, 0);
});

test("本地清理：remove 返回成功但对象仍在时失败", async () => {
  const f = fixture({ present: true, noRemoveEffect: true });
  assert.equal((await runDocumentCleanup(createLocalDocumentCleanupPort(f.admin))).status, "failed");
  assert.equal(f.calls.filter(c => c.path.endsWith("/document_library_finish")).length, 0);
});

test("本地清理：数据库零影响不能当成清理完成", async () => {
  const f = fixture({ zeroFinish: true });
  assert.equal((await runDocumentCleanup(createLocalDocumentCleanupPort(f.admin))).status, "failed");
});

test("本地清理：实际命令缺少专属声明时在连接前拒绝", () => {
  const result = spawnSync(process.execPath, ["scripts/document-cleanup-local.mjs"], {
    cwd: new URL("../../", import.meta.url),
    env: { ...process.env, PT5_E2E_FIXTURE_MODE: "", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321", SUPABASE_SERVICE_ROLE_KEY: "synthetic-never-used" },
    encoding: "utf8", timeout: 10_000, windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /destructive E2E fixtures require/);
  assert.equal(result.stdout, "");
  assert(!result.stderr.includes("synthetic-never-used"));
});

/** 单独编译实际CLI接线，所有依赖显式注入；SDK创建和认领只记次数，不进行网络或数据库操作。 */
async function runCommandFixture(change = {}, paused = "off|0|0", status = "succeeded") {
  const project = "pt5-e2e-document-cleanup";
  const calls = { sdk: 0, claim: 0, docker: [], output: "" };
  const process = { env: { PLAYWRIGHT_BASE_URL: "http://localhost:3000", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:48022",
    PT5_E2E_FIXTURE_MODE: "disposable", PT5_E2E_DATABASE_PROJECT: project,
    PT5_E2E_DATABASE_CONTAINER: `supabase_db_${project}`, SUPABASE_SERVICE_ROLE_KEY: "synthetic-not-for-output", ...change },
    stdout: { write: value => { calls.output += value; } }, exitCode: 0 };
  const require = name => {
    if (name === "@supabase/supabase-js") return { createClient: () => { calls.sdk++; return {}; } };
    if (name.endsWith("/_shared/document-cleanup.ts")) return { runDocumentCleanup: async () => { calls.claim++; return { status, completed: [], failed: [], expectedCount: 0 }; } };
    if (name.endsWith("/disposable-fixture.ts")) return { requireDisposableFixture, readDisposablePostgresTarget };
    if (name === "./document-cleanup-local-port.mjs") return { createLocalDocumentCleanupPort: () => ({}) };
    if (name === "node:fs") return { readFileSync: () => "[api]\nport=48021\n" };
    if (name === "./learning/local-api-config.mjs") return { readDeclaredApiPort: () => 48021, isDeclaredLocalApi: (url, port) => new URL(url).port === String(port) };
    if (name === "node:child_process") return { execFileSync: (command, args, options) => {
      assert.equal(command, "docker"); calls.docker.push({ args, options });
      return args[0] === "inspect" ? JSON.stringify({ running: true, labels: { "com.supabase.cli.project": project },
        ports: { "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: "48022" }] }, networks: { own: { NetworkID: "dedicated" } } }) : paused;
    } };
    throw new Error(`unexpected_cleanup_import:${name}`);
  };
  const file = new URL("../document-cleanup-local.mjs", import.meta.url);
  const source = fs.readFileSync(file, "utf8").replaceAll("import.meta.url", JSON.stringify(file.href));
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  try {
    await vm.runInNewContext(`(async()=>{${compiled}})()`, { require, exports: {}, process, URL });
    return { calls, exitCode: process.exitCode };
  } catch (error) { return { calls, error }; }
}

test("全实例清理即使显式声明disposable，也必须在SDK创建前拒绝共享项目", async () => {
  const result = await runCommandFixture({ NEXT_PUBLIC_SUPABASE_URL: "http://localhost:48021",
    PT5_E2E_DATABASE_PROJECT: "pt5-dropshipping", PT5_E2E_DATABASE_CONTAINER: "supabase_db_pt5-dropshipping" });
  assert.match(result.error?.message ?? "", /dedicated_project/);
  assert.equal(result.calls.sdk, 0);
  assert.equal(result.calls.claim, 0);
  assert.equal(result.calls.docker.length, 0);
});

test("全实例清理要求真实关联预检通过，结果失败保持JSON和非零退出码", async () => {
  for (const status of ["succeeded", "failed", "partial_failed"]) {
    const result = await runCommandFixture({}, "off|0|0", status);
    assert.equal(result.error, undefined);
    assert.equal(result.calls.sdk, 1);
    assert.equal(result.calls.claim, 1);
    assert.equal(result.calls.docker.length, 3);
    assert.equal(result.exitCode, status === "succeeded" ? 0 : 1);
    assert.equal(JSON.parse(result.calls.output).status, status);
    assert(!result.calls.output.includes("synthetic-not-for-output"));
  }
});

test("全实例清理预检有活动任务或队列时不创建SDK或认领", async () => {
  for (const paused of ["on|0|0", "off|1|0", "off|0|1"]) {
    const result = await runCommandFixture({}, paused);
    assert.match(result.error?.message ?? "", /paused_scheduler_and_empty_queue/);
    assert.equal(result.calls.sdk, 0);
    assert.equal(result.calls.claim, 0);
  }
});

test("实际CLI即使有disposable声明也拒绝当前共享项目且不输出密钥", () => {
  const result = spawnSync(process.execPath, ["scripts/document-cleanup-local.mjs"], {
    cwd: new URL("../../", import.meta.url),
    env: { ...process.env, PT5_E2E_FIXTURE_MODE: "disposable", PLAYWRIGHT_BASE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://localhost:48021", PT5_E2E_DATABASE_PROJECT: "pt5-dropshipping",
      PT5_E2E_DATABASE_CONTAINER: "supabase_db_pt5-dropshipping", SUPABASE_SERVICE_ROLE_KEY: "synthetic-never-used" },
    encoding: "utf8", timeout: 10000, windowsHide: true,
  });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /document_lock_requires_dedicated_project/);
  assert.equal(result.stdout, "");
  assert(!result.stderr.includes("synthetic-never-used"));
});
