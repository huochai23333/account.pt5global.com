import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

import { holdPostgresDocumentLock } from "../../tests/test-support/postgres-document-lock.ts";
import { readDisposablePostgresTarget } from "../../tests/test-support/disposable-fixture.ts";

// 只模拟 Node 进程事件，不导入原账号/管理员入口，也不启动 Docker 或数据库连接。
function fakeProcess(onWrite, closeOnEnd = true) {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = Object.assign(new EventEmitter(), { resume: () => {} });
  child.exitCode = null;
  child.signalCode = null;
  child.killCalls = 0;
  child.endCalls = 0;
  child.close = (code = 0) => {
    if (child.exitCode !== null) return;
    child.exitCode = code;
    child.emit("close", code, null);
  };
  child.stdin = Object.assign(new EventEmitter(), {
    write: (statement) => queueMicrotask(() => onWrite(child, statement)),
    end: () => { child.endCalls++; if (closeOnEnd) queueMicrotask(() => child.close()); },
  });
  child.kill = () => { child.killCalls++; queueMicrotask(() => child.close()); return true; };
  return child;
}

test("非法文档编号在创建进程前拒绝", async () => {
  let starts = 0;
  await assert.rejects(holdPostgresDocumentLock({ draftId: "-".repeat(36), startProcess: () => { starts++; } }), /invalid_local_fixture/);
  assert.equal(starts, 0);
});

test("分块就绪消息可识别，释放可重复且只关闭一次", async () => {
  const child = fakeProcess((process, statement) => {
    assert.match(statement, /statement_timeout='9s'/);
    assert.match(statement, /local_document_fixture_missing/);
    process.stdout.emit("data", Buffer.from("document-test-"));
    process.stdout.emit("data", Buffer.from("ready\n"));
  });
  const release = await holdPostgresDocumentLock({ draftId: "b6350000-0000-4000-8000-000000000001", startProcess: () => child });
  assert.equal(child.stdout.listenerCount("data"), 0);
  await release();
  await release();
  assert.equal(child.endCalls, 1);
});

test("就绪前退出立即失败并完成收尾", async () => {
  const child = fakeProcess((process) => process.close(1));
  await assert.rejects(holdPostgresDocumentLock({ startProcess: () => child, readyTimeoutMs: 100 }), /local_lock_process_exited/);
  assert.equal(child.exitCode, 1);
  assert.equal(child.stdout.listenerCount("data"), 0);
});

test("就绪后意外关闭时释放有界失败，不等待已发生的事件", async () => {
  const child = fakeProcess((process) => process.stdout.emit("data", Buffer.from("document-test-ready")));
  const release = await holdPostgresDocumentLock({ startProcess: () => child });
  child.close(1);
  await assert.rejects(release(), /local_lock_process_exited/);
});

test("就绪超时关闭输入并回收进程", async () => {
  const child = fakeProcess(() => {});
  await assert.rejects(holdPostgresDocumentLock({ startProcess: () => child, readyTimeoutMs: 10 }), /local_lock_timeout/);
  assert.equal(child.endCalls, 1);
  assert.equal(child.exitCode, 0);
});

test("启动报错保持原错误并回收进程", async () => {
  const child = fakeProcess((process) => process.emit("error", new Error("synthetic_spawn_failed")));
  await assert.rejects(holdPostgresDocumentLock({ startProcess: () => child }), /synthetic_spawn_failed/);
  assert.equal(child.exitCode, 0);
});

test("EOF 后仍存活则终止，并等待关闭而非只看 kill 返回值", async () => {
  const child = fakeProcess((process) => process.stdout.emit("data", Buffer.from("document-test-ready")), false);
  const release = await holdPostgresDocumentLock({ startProcess: () => child, stopTimeoutMs: 10 });
  await release();
  assert.equal(child.killCalls, 1);
  assert.equal(child.exitCode, 0);
});

test("输入管道失败也传播原错误并回收进程", async () => {
  const child = fakeProcess((process) => process.stdin.emit("error", new Error("synthetic_pipe_failed")));
  await assert.rejects(holdPostgresDocumentLock({ startProcess: () => child }), /synthetic_pipe_failed/);
  assert.equal(child.exitCode, 0);
});

test("错误输出管道失败同样有界收尾", async () => {
  const child = fakeProcess((process) => process.stderr.emit("error", new Error("synthetic_stderr_failed")));
  await assert.rejects(holdPostgresDocumentLock({ startProcess: () => child }), /synthetic_stderr_failed/);
  assert.equal(child.exitCode, 0);
});

test("终止后仍未关闭时明确报清理未完成", async () => {
  const child = fakeProcess((process) => process.stdout.emit("data", Buffer.from("document-test-ready")), false);
  child.kill = () => { child.killCalls++; return true; };
  const release = await holdPostgresDocumentLock({ startProcess: () => child, stopTimeoutMs: 10 });
  await assert.rejects(release(), /local_lock_stop_timeout/);
  assert.equal(child.killCalls, 1);
});

/** 编译真实接线文件，但只注入进程与纯守卫；意外导入认证入口立即报错，不连接任何数据库。 */
function wrapperFixture(change = {}, paused = "off|0|0") {
  const project = "pt5-e2e-document-lock";
  const reads = [], spawned = [];
  const env = { PLAYWRIGHT_BASE_URL: "http://localhost:3000", NEXT_PUBLIC_SUPABASE_URL: "http://localhost:48022",
    PT5_E2E_FIXTURE_MODE: "disposable", PT5_E2E_DATABASE_PROJECT: project,
    PT5_E2E_DATABASE_CONTAINER: `supabase_db_${project}`, ...change };
  const child = fakeProcess(process => process.stdout.emit("data", Buffer.from("document-test-ready")));
  const exports = {};
  const require = name => {
    if (name === "node:child_process") return {
      execFileSync(command, args, options) {
        reads.push({ command, args, options });
        if (args[0] === "inspect") return JSON.stringify({ labels: { "com.supabase.cli.project": project }, running: true,
          ports: { "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: "48022" }] }, networks: { fixture: { NetworkID: "owned" } } });
        return paused;
      },
      spawn(command, args, options) { spawned.push({ command, args, options }); return child; },
    };
    if (name === "../../test-support/disposable-fixture") return { readDisposablePostgresTarget };
    if (name === "../../test-support/postgres-document-lock") return { holdPostgresDocumentLock };
    throw new Error(`unexpected_wrapper_import:${name}`);
  };
  const source = fs.readFileSync(new URL("../../tests/e2e/helpers/document-write-lock.ts", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  vm.runInNewContext(compiled, { exports, require, process: { env }, URL });
  return { lock: exports.holdDocumentWrites, sql: exports.runDocumentFixtureSql, reads, spawned, child, project };
}

test("真实锁接线拒绝共享项目或缺失声明，Docker读取与锁进程均为零", async () => {
  for (const change of [{ PT5_E2E_FIXTURE_MODE: undefined }, { PT5_E2E_DATABASE_PROJECT: "pt5-dropshipping" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://remote.example.test" }]) {
    const f = wrapperFixture(change);
    await assert.rejects(f.lock());
    assert.equal(f.reads.length, 0);
    assert.equal(f.spawned.length, 0);
  }
});

test("真实锁接线只在目标项目检查调度，再启动并释放同一容器的锁", async () => {
  const f = wrapperFixture();
  const release = await f.lock();
  assert.equal(f.reads.length, 3);
  assert.equal(f.reads[2].args[3], `supabase_db_${f.project}`);
  assert.match(f.reads[2].args.at(-1), /cron\.launch_active_jobs/);
  assert(!f.reads.slice(0, 2).some(read => read.args.join(" ").includes("Config.Env")));
  assert.equal(f.spawned.length, 1);
  assert.equal(f.spawned[0].args[2], `supabase_db_${f.project}`);
  assert.equal(f.spawned[0].options.windowsHide, true);
  await release();
  assert.equal(f.child.endCalls, 1);
});

test("调度未暂停、启用任务或外部请求未清空时不启动锁", async () => {
  for (const paused of ["on|0|0", "off|1|0", "off|0|1", "", "off|0|"]) {
    const f = wrapperFixture({}, paused);
    await assert.rejects(f.lock(), /paused_scheduler_and_empty_queue/);
    assert.equal(f.spawned.length, 0);
  }
});

test("故障SQL沿同一准入目标、标准输入与双层期限执行，缺少隔离时不运行", () => {
  const f = wrapperFixture();
  f.sql("select 'owned-fixture';");
  assert.equal(f.reads.length, 4);
  assert.equal(f.reads[3].args[4], `supabase_db_${f.project}`);
  assert.equal(f.reads[3].options.input, "select 'owned-fixture';");
  assert.equal(f.reads[3].options.timeout, 15000);
  assert.equal(f.reads[3].options.windowsHide, true);
  assert.match(f.reads[3].args[3], /statement_timeout=12000 -c lock_timeout=10000/);
  const denied = wrapperFixture({ PT5_E2E_DATABASE_PROJECT: "pt5-dropshipping" });
  assert.throws(() => denied.sql("select 'must-not-run';"), /dedicated_project/);
  assert.equal(denied.reads.length, 0);
});
