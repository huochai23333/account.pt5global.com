import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { EventEmitter } from "node:events";
import ts from "typescript";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";
import { readDisposablePostgresTarget } from "../../tests/test-support/disposable-fixture.ts";
import { createSalesLeadSyncFixture, salesLeadFixtureSql } from "../../../PT5-dropshipping-supabase/scripts/sales-lead-sync-fixture.mjs";

test("资源按顺序完成，不同时启动下一步", async () => {
  const events = [];
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const result = cleanupFixtureResources(
    async () => {
      events.push("first-start");
      await pending;
      events.push("first-end");
    },
    async () => {
      events.push("second");
    },
  );
  assert.deepEqual(events, ["first-start"]);
  release();
  await result;
  assert.deepEqual(events, ["first-start", "first-end", "second"]);
});

test("第一个资源失败，后续资源仍回收并原样保留错误", async () => {
  const failure = new Error("browser-close-failed");
  let cleaned = false;
  await assert.rejects(
    cleanupFixtureResources(
      async () => {
        throw failure;
      },
      async () => {
        cleaned = true;
      },
    ),
    (error) =>
      error instanceof AggregateError &&
      error.errors.length === 1 &&
      error.errors[0] === failure,
  );
  assert.equal(cleaned, true);
});

test("多个失败均保留，最后资源也会尝试", async () => {
  const first = new Error("documents-failed");
  const second = new Error("folder-failed");
  const events = [];
  await assert.rejects(
    cleanupFixtureResources(
      async () => {
        throw first;
      },
      async () => {
        throw second;
      },
      async () => {
        events.push("last");
      },
    ),
    (error) => {
      assert.deepEqual(error.errors, [first, second]);
      return error instanceof AggregateError;
    },
  );
  assert.deepEqual(events, ["last"]);
});

test("空资源集合无副作用，最后一步失败也不能当作成功", async () => {
  await cleanupFixtureResources();
  const failure = new Error("last-failed");
  await assert.rejects(
    cleanupFixtureResources(
      async () => {},
      async () => {
        throw failure;
      },
    ),
    (error) => error.errors[0] === failure,
  );
});

/** 直接运行当前 CLI 正文，只替换进程/HTTP 边界；不加载原认证入口，不连接真实服务。 */
async function runSalesLeadLifecycle(scenario) {
  const file = new URL("../../../PT5-dropshipping-supabase/scripts/test-sales-lead-sync-local.mjs", import.meta.url);
  const source = fs.readFileSync(file, "utf8");
  const syntax = ts.createSourceFile(file.pathname, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const body = syntax.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(syntax)).join("\n");
  const project = "pt5-e2e-lead-lifecycle", state = { lock_token: null, last_error: "before" };
  const fixture = createSalesLeadSyncFixture(), actions = new Map(), events = [], logs = [];
  let prepared = false, cleaned = false;
  const server = new EventEmitter();
  server.listening = false;
  server.listen = (_port, _host, ready) => {
    if (scenario === "bind-error") queueMicrotask(() => server.emit("error", new Error("EADDRINUSE")));
    else { server.listening = true; ready(); }
  };
  server.close = callback => {
    events.push("server-close"); server.listening = false;
    callback(scenario === "close-error" ? new Error("server-close-failed") : undefined);
  };
  server.closeAllConnections = () => events.push("close-owned-connections");
  const docker = (command, args, options) => {
    assert.equal(command, "docker");
    if (args[0] === "inspect") {
      const common = { labels: { "com.supabase.cli.project": project }, running: true,
        networks: { fixture: { NetworkID: "synthetic-same" } } };
      if (args.at(-1).startsWith("supabase_edge_runtime_")) return JSON.stringify({ ...common,
        env: ["SUPABASE_URL=http://kong:8000", "SALES_LEAD_GITHUB_CONTENTS_URL=http://host.docker.internal:43193/contents"] });
      if (args.includes("{{json .NetworkSettings.Networks}}")) return JSON.stringify(common.networks);
      return JSON.stringify({ ...common, ports: { "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: "48031" }] } });
    }
    if (!options?.input) return "off|0|0";
    const input = options.input, action = actions.get(input);
    if (action) events.push(action);
    if (action === "inspect") return JSON.stringify({ state, owned: {}, waitMs: 0 });
    if (action === "prepare") {
      prepared = true;
      if (scenario !== "post-and-cleanup-error") throw new Error("prepare-commit-receipt-lost");
      return "t";
    }
    if (action === "dispatch") return "t";
    if (action === "cleanup") {
      if (scenario === "post-and-cleanup-error") throw new Error("worker-not-confirmed-idle");
      cleaned = true; return "t";
    }
    if (input.includes("select shared_secret")) return "synthetic-job-token";
    if (input.includes("to_regclass")) return input.includes("is not null") ? String(prepared && !cleaned ? "t" : "f") : String(cleaned ? "t" : "f");
    if (input.includes("select count(*)")) return "1";
    throw new Error("unrecognized-synthetic-query");
  };
  const context = { assert, URL, AbortSignal, readDisposablePostgresTarget,
    createSalesLeadSyncFixture: () => fixture, execFileSync: docker, http: { createServer: () => server },
    salesLeadFixtureSql: (value, action, attempt) => {
      const input = salesLeadFixtureSql(value, action, attempt); actions.set(input, action); return input;
    },
    process: { env: { PT5_E2E_FIXTURE_MODE: "disposable", PLAYWRIGHT_BASE_URL: "http://localhost:3000",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:48031", PT5_E2E_DATABASE_PROJECT: project,
      PT5_E2E_DATABASE_CONTAINER: `supabase_db_${project}` } },
    console: { log: value => logs.push(value) },
    fetch: async (_url, options) => {
      if (options.method === "OPTIONS") return { ok: true };
      throw new Error("post-receipt-lost");
    },
  };
  let failure;
  try { await vm.runInNewContext(`(async()=>{${body}})()`, context, { timeout: 5000 }); }
  catch (error) { failure = error; }
  assert(failure, "故障场景必须失败"); assert.equal(logs.length, 0, "业务或清理不确定时不输出成功");
  return { failure, events, prepared, cleaned };
}

test("来源端口已占用时不准备业务数据，也不关闭其他监听", async () => {
  const result = await runSalesLeadLifecycle("bind-error");
  assert.match(result.failure.errors[0].message, /EADDRINUSE/);
  assert.equal(result.prepared, false); assert.deepEqual(result.events, []);
});

test("准备已提交但回执丢失，仍查找本次备份并执行清理", async () => {
  const result = await runSalesLeadLifecycle("prepare-receipt-lost");
  assert.equal(result.failure.errors.length, 1); assert.equal(result.cleaned, true);
  assert(result.events.indexOf("server-close") < result.events.indexOf("cleanup"));
  assert.match(result.failure.errors[0].message, /专属SQL未确认完成/);
});

test("函数回执和数据库清理均失败时保留两个原因", async () => {
  const result = await runSalesLeadLifecycle("post-and-cleanup-error");
  assert.equal(result.failure.errors.length, 2); assert.equal(result.cleaned, false);
  assert.equal(result.failure.errors[0].message, "post-receipt-lost");
  assert.match(result.failure.errors[1].message, /专属SQL未确认完成/);
});

test("来源服务关闭失败也继续清理数据，不覆盖主体错误", async () => {
  const result = await runSalesLeadLifecycle("close-error");
  assert.equal(result.cleaned, true); assert.equal(result.failure.errors.length, 2);
  assert.equal(result.failure.errors[1].message, "server-close-failed");
});
