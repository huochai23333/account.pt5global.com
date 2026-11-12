import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import * as records from "../../tests/test-support/customer-alias-records.ts";
import { readDisposablePostgresTarget } from "../../tests/test-support/disposable-fixture.ts";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";

const id = "b1000000-0000-4000-8000-000000000001", creator = "b1000000-0000-4000-8000-000000000002";
/** 真实SDK解析精确条件/回执；invalid域的请求全部由内存HTTP接管，不连接真实服务。 */
function harness(change = {}) {
  const rows = [], calls = [];
  const response = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
  const client = createClient("http://customer-alias.invalid", "synthetic-test-key", {
    auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (input, options = {}) => {
      const url = new URL(String(input)), method = options.method ?? "GET";
      assert.equal(url.hostname, "customer-alias.invalid");assert.equal(url.pathname, "/rest/v1/wholesale_customers");
      calls.push({ method, filters: [...url.searchParams] });
      if (change.readError && method === "GET") return response({ message: "read_failed" }, 400);
      if (change.concurrentUpdate && method === "DELETE") rows[0].edit_revision += 1;
      const matches = row => [...url.searchParams].every(([column, value]) => {
        if (column === "select") return true;
        if (value === "is.null") return row[column] === null;
        assert(value.startsWith("eq."));return String(row[column]) === value.slice(3);
      });
      let found = rows.filter(matches);
      if (method === "HEAD") return new Response(null, { headers: change.unknownCount ? {} : { "content-range": "*/" + found.length } });
      if (method === "DELETE") {
        if (change.requireClosedPage) assert.equal(change.pageClosed, true, "本次页面必须先关闭再删除夹具");
        if (!change.retainRow) for (const row of found) rows.splice(rows.indexOf(row), 1);
        if (change.zeroDelete) found = [];
        if (change.wrongDelete) found = [{ id: creator }];
        return response(change.nullDelete ? null : found);
      }
      assert.equal(method, "GET");
      return response(change.nullRead ? null : change.badRead ? [change.badRead] : found);
    } },
  });
  const seed = fixture => {
    const row = { id, unique_name: fixture.customerName, notes: fixture.marker, other_names: [fixture.initialName],
      edit_revision: 1, customer_kind: "sales_created", registered_user_id: null, created_by_user_id: creator };
    rows.push(row);return row;
  };
  return { client, rows, calls, seed };
}

/** 只编译夹具接线，严格限定运行时依赖；原管理员入口被显式诊断端口接管，不读取其文件。 */
function wrapper(h, change = {}) {
  const project = "pt5-e2e-customer-alias", calls = [];
  const env = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:48121", PT5_E2E_FIXTURE_MODE: "disposable",
    PT5_E2E_DATABASE_PROJECT: project, PT5_E2E_DATABASE_CONTAINER: `supabase_db_${project}`, ...change.env };
  const source = fs.readFileSync(new URL("../../tests/e2e/helpers/customer-alias-fixture.ts", import.meta.url), "utf8"), exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, {
    exports, AggregateError, process: { env }, require(name) {
      if (name === "@playwright/test") return { test: { extend: value => value } };
      if (name === "./local-supabase-admin") return { getLocalSupabaseAdminClient() { calls.push("admin");return h.client; } };
      if (name === "../../test-support/customer-alias-records") return records;
      if (name === "../../test-support/disposable-fixture") return { readDisposablePostgresTarget };
      if (name === "../../test-support/fixture-cleanup-sequence") return { cleanupFixtureResources };
      if (name === "node:child_process") return { execFileSync(command, args, options) {
        assert.equal(command, "docker");assert.equal(options.timeout, 10000);calls.push(args[0]);
        if (args[0] === "inspect") return JSON.stringify({ running: true, labels: { "com.supabase.cli.project": project },
          ports: { "8000/tcp": [{ HostIp: "127.0.0.1", HostPort: change.port ?? "48121" }] }, networks: { own: { NetworkID: "own" } } });
        return change.idle ?? "off|0|0";
      } };
      throw new Error("unexpected_customer_alias_import:" + name);
    },
  });
  const page = { close: async () => {
    calls.push("close"); change.pageClosed = true;
    if (change.pageCloseError) throw change.pageCloseError;
  } };
  return { run: use => exports.test.customerAlias({ baseURL: "http://localhost:3000", page }, use), calls, change };
}

test("每次清单使用独立UUID名称与精确备注，不引用固定客户", () => {
  const a = records.createCustomerAliasFixture(), b = records.createCustomerAliasFixture();
  assert.notEqual(a.customerName, b.customerName);assert.notEqual(a.marker, b.marker);assert.equal(a.customerId, undefined);
});
test("独立读回绑定真实ID，追加及重试保持相同名称集合和版本", async () => {
  const h = harness(), f = records.createCustomerAliasFixture(), row = h.seed(f);
  assert.deepEqual(await records.verifyCustomerAliasRecord(h.client, f, [f.initialName], 1), { id, revision: 1, names: [f.initialName] });
  row.other_names.push(f.aliasName);row.edit_revision = 2;
  const value = await records.verifyCustomerAliasRecord(h.client, f, [f.initialName, f.aliasName], 2);
  assert.deepEqual(await records.verifyCustomerAliasRecord(h.client, f, [f.initialName, f.aliasName], 2), value);
});
test("缺记录或空正文不能当成别名保存完成", async () => {
  for (const change of [{}, { nullRead: true }]) { const h = harness(change), f = records.createCustomerAliasFixture();
    await assert.rejects(records.verifyCustomerAliasRecord(h.client, f, [f.initialName], 1), /saved_state_missing/); }
});
test("备注/来源/注册归属/版本/重复名称异常在任何删除前拒绝", async () => {
  for (const change of [{ notes: "foreign" }, { customer_kind: "registered_account" }, { registered_user_id: creator }, { edit_revision: 0 }, { other_names: ["x", "x"] }, { created_by_user_id: null }]) {
    const h = harness(), f = records.createCustomerAliasFixture();Object.assign(h.seed(f), change);
    await assert.rejects(records.cleanupCustomerAliasRecord(h.client, f), /record_unconfirmed/);assert(!h.calls.some(c => c.method === "DELETE"));
  }
});
test("错误名称集合或错误修订不能通过保存凭证", async () => {
  const h = harness(), f = records.createCustomerAliasFixture();h.seed(f);
  await assert.rejects(records.verifyCustomerAliasRecord(h.client, f, [f.aliasName], 1), /saved_state_missing/);
  await assert.rejects(records.verifyCustomerAliasRecord(h.client, f, [f.initialName], 2), /saved_state_missing/);
});
test("绑定后即使同名同备注也拒绝另一个客户ID", async () => {
  const change = {}, h = harness(change), f = records.createCustomerAliasFixture(), row = h.seed(f);
  await records.verifyCustomerAliasRecord(h.client, f, [f.initialName], 1);
  change.badRead = { ...row, id: creator };
  await assert.rejects(records.cleanupCustomerAliasRecord(h.client, f), /id_changed/);
  assert(!h.calls.some(c => c.method === "DELETE"));
});
test("删除受七项身份/归属/修订条件约束，另查两次零残留并保留外来行", async () => {
  const h = harness(), f = records.createCustomerAliasFixture();h.seed(f);h.rows.push({ id: creator, unique_name: "其他客户", notes: "其他运行" });
  await records.cleanupCustomerAliasRecord(h.client, f);assert.deepEqual(h.rows, [{ id: creator, unique_name: "其他客户", notes: "其他运行" }]);
  const deletion = h.calls.find(c => c.method === "DELETE");assert.equal(deletion.filters.filter(([c]) => c !== "select").length, 7);
  assert.equal(h.calls.filter(c => c.method === "HEAD").length, 2);
});
test("读取后并发更新修订时删除零行，保留新版本并报失败", async () => {
  const h = harness({ concurrentUpdate: true }), f = records.createCustomerAliasFixture(), row = h.seed(f);
  await assert.rejects(records.cleanupCustomerAliasRecord(h.client, f), /delete_unconfirmed/);
  assert.equal(h.rows.length, 1);assert.equal(row.edit_revision, 2);
});
test("创建前中断或已清理可再次核对，不执行无条件删除", async () => {
  const h = harness(), f = records.createCustomerAliasFixture();await records.cleanupCustomerAliasRecord(h.client, f);assert(!h.calls.some(c => c.method === "DELETE"));
  h.seed(f);await records.cleanupCustomerAliasRecord(h.client, f);await records.cleanupCustomerAliasRecord(h.client, f);assert.equal(h.calls.filter(c => c.method === "DELETE").length, 1);
});
test("零影响/错误ID/缺删除正文均保留失败", async () => {
  for (const change of [{ zeroDelete: true }, { wrongDelete: true }, { nullDelete: true }]) {
    const h = harness(change), f = records.createCustomerAliasFixture();h.seed(f);await assert.rejects(records.cleanupCustomerAliasRecord(h.client, f), /delete_unconfirmed/);
  }
});
test("残留、未知计数及读取失败均不能伪造已回收", async () => {
  for (const change of [{ retainRow: true }, { unknownCount: true }, { readError: true }, { nullRead: true }]) {
    const h = harness(change), f = records.createCustomerAliasFixture();h.seed(f);await assert.rejects(records.cleanupCustomerAliasRecord(h.client, f));
    if (change.readError || change.nullRead) assert(!h.calls.some(c => c.method === "DELETE"));
  }
});
test("夹具在管理员入口前拒绝共享目标/错误端口/未暂停状态", async () => {
  for (const change of [{ env: { PT5_E2E_FIXTURE_MODE: "" } }, { env: { PT5_E2E_DATABASE_PROJECT: "pt5-dropshipping" } }, { port: "48122" }, { idle: "on|0|0" }]) {
    const h = harness(), w = wrapper(h, change);await assert.rejects(w.run(async () => assert.fail("must not provide")));assert(!w.calls.includes("admin"));assert.equal(h.calls.length, 0);
  }
});
test("实际夹具声明提供读回并在退出后清理，前后都核对项目", async () => {
  const change = { requireClosedPage: true }, h = harness(change), w = wrapper(h, change);await w.run(async fixture => { h.seed(fixture);await fixture.verify([fixture.initialName], 1);assert.equal(fixture.customerId, id); });
  assert.equal(h.rows.length, 0);assert.equal(w.calls.filter(c => c === "inspect").length, 4);
});
test("主体失败和清理失败同时保留，原错误不会被最后异常覆盖", async () => {
  const h = harness({ zeroDelete: true }), w = wrapper(h), body = new Error("body_failed");
  await assert.rejects(w.run(async fixture => { h.seed(fixture);throw body; }), error => error.message === "customer_alias_fixture_cleanup_failed"
    && error.errors[0] === body && /delete_unconfirmed/.test(error.errors[1].message));
});
test("执行过程中目标变更时拒绝数据清理，保留本次记录等待核对", async () => {
  const h = harness(), change = {}, w = wrapper(h, change);
  await assert.rejects(w.run(async fixture => { h.seed(fixture);change.idle = "off|1|0"; }));
  assert.equal(h.rows.length, 1);assert(!h.calls.some(c => c.method === "DELETE"));
});

test("页面关闭失败仍清理本次客户，失败不会被当作完成", async () => {
  const failure = new Error("close-failed"), change = { pageCloseError: failure }, h = harness(change), w = wrapper(h, change);
  await assert.rejects(w.run(async fixture => { h.seed(fixture); }), error => error.errors[0] === failure);
  assert.equal(h.rows.length, 0);
});

test("主体、页面关闭与数据库清理三种失败都保留", async () => {
  const body = new Error("body-failed"), close = new Error("close-failed");
  // 同时保留存储行并返回空删除回执，明确模拟实际零命中，而非已提交后回执丢失。
  const change = { pageCloseError: close, zeroDelete: true, retainRow: true }, h = harness(change), w = wrapper(h, change);
  await assert.rejects(w.run(async fixture => { h.seed(fixture); throw body; }), error =>
    error.errors.length === 3 && error.errors[0] === body && error.errors[1] === close && /delete_unconfirmed/.test(error.errors[2].message));
  assert.equal(h.rows.length, 1);
});
