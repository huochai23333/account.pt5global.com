import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";
import { createMonthlySettlementFixture, prepareMonthlySettlementFixture, insertMonthlySettlementBalances } from "../../tests/e2e/helpers/monthly-settlement-fixture.ts";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";

/** 仅编译纯收尾模块，显式接管Docker准入；不解析原Auth/账号/管理员模块。 */
function lifecycle() {
  const source = fs.readFileSync(new URL("../../tests/test-support/monthly-settlement-lifecycle.ts", import.meta.url), "utf8");
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    exports, process: { env: {} }, require(name) {
      if (name === "node:child_process") return { execFileSync() { throw new Error("unexpected_docker"); } };
      if (name === "./disposable-fixture") return { readDisposablePostgresTarget() { throw new Error("target_not_verified"); } };
      if (name === "./fixture-cleanup-sequence") return { cleanupFixtureResources };
      throw new Error("unexpected_monthly_import:" + name);
    },
  });
  return exports;
}

/** 实际Supabase SDK搭配完全接管的HTTP；内存表/Auth只模拟传输合同，不代表真实服务。 */
function harness(change = {}) {
  const tables = new Map(), users = new Map(), calls = [];
  const rows = table => { if (!tables.has(table)) tables.set(table, []); return tables.get(table); };
  // Auth错误码由实际API版本响应头决定，模拟HTTP也必须声明当前协议，不能只塞JSON字段。
  const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json", "x-supabase-api-version": "2024-01-01", ...headers } });
  let sequence = 0;
  const uuid = () => `ab000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
  for (const role of ["administrator", "finance", "salesman"]) rows("user_roles").push({ id: uuid(), role });
  const client = createClient("http://monthly-fixture.invalid", "synthetic-test-key", {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: async (input, options = {}) => {
      const url = new URL(String(input)), method = options.method ?? "GET", headers = new Headers(options.headers);
      assert.equal(url.hostname, "monthly-fixture.invalid");
      const body = options.body ? JSON.parse(options.body) : null;
      calls.push({ path: url.pathname, method });
      if (url.pathname === "/auth/v1/admin/users" && method === "POST") {
        const user = { id: uuid(), email: body.email }; users.set(user.id, user);
        rows("user_profiles").push({ id: uuid(), user_id: user.id, status: "pending" });
        return json(user);
      }
      if (url.pathname.startsWith("/auth/v1/admin/users/")) {
        const id = url.pathname.split("/").at(-1), user = users.get(id);
        if (method === "DELETE") {
          if (!change.retainUser) users.delete(id);
          return json(change.wrongAuthReceipt ? { id: uuid() } : user);
        }
        if (user) return json(user);
        return json({ code: change.authReadCode ?? "user_not_found", message: "fixture missing" }, change.authReadStatus ?? 404);
      }
      assert(url.pathname.startsWith("/rest/v1/"));
      const table = url.pathname.split("/").at(-1), data = rows(table);
      if (change.readFailure === table && ["GET", "HEAD"].includes(method)) return json({ message: "read_failed" }, 500);
      const matches = row => [...url.searchParams].every(([key, value]) => {
        if (["select", "on_conflict"].includes(key)) return true;
        if (value.startsWith("eq.")) return String(row[key]) === value.slice(3);
        assert(value.startsWith("in.("));return value.slice(4, -1).split(",").map(v => v.replaceAll('"', '')).includes(row[key]);
      });
      let selected = data.filter(matches);
      if (method === "POST") {
        selected = (Array.isArray(body) ? body : [body]).map(row => ({ id: row.id ?? uuid(), ...row }));data.push(...selected);
      } else if (method === "PATCH") {
        if (change.zeroProfile) selected = [];else selected.forEach(row => Object.assign(row, body));
      } else if (method === "DELETE") {
        if (change.zeroDelete === table) selected = [];else tables.set(table, data.filter(row => !selected.includes(row)));
      } else assert(["GET", "HEAD"].includes(method));
      if (method === "HEAD") return new Response(null, { status: 200, headers: change.unknownCount ? {} : { "content-range": `*/${selected.length}` } });
      if (change.badReleaseReceipt && table === "wholesale_settlement_releases" && method === "POST") selected = selected.slice(1);
      const value = headers.get("accept")?.includes("vnd.pgrst.object") ? selected[0] ?? null : selected;
      return json(value);
    } },
  });
  return { client, rows, tables, users, calls };
}
const clean = lifecycle().cleanupMonthlySettlementFixture;
const flatten = error => error.errors ? error.errors.flatMap(flatten) : [error];

test("上海月初清单保留上月最后一天，跨年也不依赖宿主时区", () => {
  const f = createMonthlySettlementFixture(new Date("2025-12-31T16:00:00Z"));
  assert.equal(f.date, "2026-01-01");assert.equal(f.monthStart, "2026-01-01");assert.equal(f.previousDate, "2025-12-31");
  assert.equal(new Set(f.notes).size, 5);assert.notEqual(f.customerId, f.orderId);
});
test("实际SDK准备三岗位/客户/订单并核对写入编号", async () => {
  const h = harness(), f = createMonthlySettlementFixture();await prepareMonthlySettlementFixture(h.client, f);
  assert.equal(f.userIds.length, 3);assert.deepEqual(f.accounts.map(a => a.role), ["administrator", "finance", "salesman"]);
  for (const table of ["user_profiles", "user_roles_data", "user_workspace_business_access"]) assert.deepEqual(h.rows(table).map(r => r.user_id), f.userIds);
  assert.equal(h.rows("wholesale_customers")[0].assigned_sales_user_id, f.userIds[2]);
  assert.equal(h.rows("wholesale_orders")[0].customer_payment_amount, 10000);
});
test("配置零行不能继续准备，已创建账号仍在收尾清单", async () => {
  const h = harness({ zeroProfile: true }), f = createMonthlySettlementFixture();
  await assert.rejects(prepareMonthlySettlementFixture(h.client, f), /完整写入/);
  assert.equal(f.userIds.length, 1);assert.equal(f.accounts.length, 0);assert.equal(h.rows("wholesale_orders").length, 0);
});
test("余额夹具保持四种金额/月份/取消状态，缺准确回执必须失败", async () => {
  const h = harness(), f = createMonthlySettlementFixture();await prepareMonthlySettlementFixture(h.client, f);await insertMonthlySettlementBalances(h.client, f);
  assert.deepEqual(h.rows("wholesale_settlement_releases").map(r => [r.release_amount, r.release_currency, r.received_on, r.status]), [
    [124293.70, "CNY", f.date, "pending"], [50203.40, "USD", f.date, "pending"], [999, "USD", f.previousDate, "pending"], [88, "USD", f.date, "cancelled"],
  ]);
  const bad = harness({ badReleaseReceipt: true });await assert.rejects(insertMonthlySettlementBalances(bad.client, f), /准确写入凭证/);
});
async function prepared(change) {
  const h = harness(change), f = createMonthlySettlementFixture();await prepareMonthlySettlementFixture(h.client, f);
  h.rows("wholesale_customers").push(...f.userIds.map((id, i) => ({ id: `reg-${i}`, registered_user_id: id })), { id: "foreign", registered_user_id: "other-user", name: "保护样例" });
  h.users.set("foreign-user", { id: "foreign-user" });return { h, f };
}
test("逐类精确清理并另请求查回，其他运行的客户与账号保留", async () => {
  const { h, f } = await prepared(), events = [];
  await clean(h.client, f, [{ close: async () => events.push("page") }], async () => events.push("releases"), () => events.push("guard"));
  assert.deepEqual(events, ["page", "guard", "releases"]);assert.equal(h.rows("wholesale_orders").length, 0);
  assert.deepEqual(h.rows("wholesale_customers"), [{ id: "foreign", registered_user_id: "other-user", name: "保护样例" }]);
  assert.deepEqual([...h.users.keys()], ["foreign-user"]);assert.equal(h.calls.filter(c => c.path.startsWith("/auth/") && c.method === "GET").length, 3);
});
test("页面关闭和收款清理失败仍尝试后续资源，全部原错误保留", async () => {
  const { h, f } = await prepared(), first = new Error("page_failed"), second = new Error("release_failed");
  await assert.rejects(clean(h.client, f, [{ close: async () => { throw first; } }], async () => { throw second; }, () => {}), error => {
    assert.deepEqual(flatten(error), [first, second]);return true;
  });
  assert.equal(h.rows("wholesale_orders").length, 0);assert.equal(h.users.size, 1);
});
test("实际零删除和未知残留计数不能冒充完成", async () => {
  for (const change of [{ zeroDelete: "wholesale_orders" }, { unknownCount: true }]) {
    const { h, f } = await prepared(change);
    await assert.rejects(clean(h.client, f, [], async () => {}, () => {}), error => flatten(error).some(e => /删除记录不一致|计数未知/.test(e.message)));
    assert.equal(h.calls.filter(c => c.method === "DELETE" && c.path.startsWith("/auth/")).length, 3);
  }
});
test("读取失败不执行该表删除，仍尝试其他资源", async () => {
  const { h, f } = await prepared({ readFailure: "wholesale_orders" });
  await assert.rejects(clean(h.client, f, [], async () => {}, () => {}));
  assert(!h.calls.some(c => c.path.endsWith("/wholesale_orders") && c.method === "DELETE"));assert.equal(h.users.size, 1);
});
test("账号回执错误、仍存在及403均不得当作删除成功", async () => {
  for (const change of [{ wrongAuthReceipt: true }, { retainUser: true }, { authReadStatus: 403, authReadCode: "not_authorized" }]) {
    const { h, f } = await prepared(change);await assert.rejects(clean(h.client, f, [], async () => {}, () => {}));
    assert.equal(h.calls.filter(c => c.path.startsWith("/auth/") && c.method === "DELETE").length, 3);
  }
});
test("目标核验失败仍关页面，但不发起任何数据库或Auth清理", async () => {
  const h = harness(), f = createMonthlySettlementFixture(), failure = new Error("wrong_target");let closed = false, releases = false;
  await assert.rejects(clean(h.client, f, [{ close: async () => { closed = true; } }], async () => { releases = true; }, () => { throw failure; }));
  assert(closed);assert(!releases);assert.equal(h.calls.length, 0);assert.throws(() => lifecycle().assertMonthlySettlementTarget(), /target_not_verified/);
});
test("原月度声明同时保留准备与清理错误，不加载原认证入口", async () => {
  const source = fs.readFileSync(new URL("../../tests/e2e/wholesale-settlement-monthly-unallocated.spec.ts", import.meta.url), "utf8");
  const ast = ts.createSourceFile("monthly.ts", source, ts.ScriptTarget.Latest, true);
  const statement = ast.statements.find(s => ts.isExpressionStatement(s) && ts.isCallExpression(s.expression) && s.expression.expression.getText(ast) === "test");
  assert(statement);let run;const body = new Error("prepare_failed"), cleanup = new Error("cleanup_failed");
  vm.runInNewContext(ts.transpileModule(statement.getText(ast), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, {
    test(_title, callback) { run = callback; }, getLocalSupabaseAdminClient: () => ({}), assertMonthlySettlementTarget() {},
    createMonthlySettlementFixture, prepareMonthlySettlementFixture: async () => { throw body; }, cleanupMonthlySettlementFixture: async () => { throw cleanup; },
  });
  await assert.rejects(run({}, { setTimeout() {} }), error => error.message === "monthly_unallocated_cleanup_failed" && error.errors[0] === body && error.errors[1] === cleanup);
});
