import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

import {
  requireProfileRequestReceipt,
  requireProfileWriteReceipt,
} from "../lib/profile-operation-receipts.ts";

test("资料更新影响 0 行时必须失败", () => {
  assert.throws(
    () => requireProfileWriteReceipt(null, { city: "上海", userId: "user-1" }),
    /没有返回可确认的保存结果/,
  );
});

test("资料更新返回其它用户或旧字段时必须失败", () => {
  assert.throws(
    () =>
      requireProfileWriteReceipt(
        { city: "杭州", name: "旧姓名", user_id: "user-2" },
        { city: "上海", name: "新姓名", userId: "user-1" },
      ),
    /与提交内容不一致/,
  );
});

test("资料申请必须返回待审核状态和同一提交内容", () => {
  assert.doesNotThrow(() =>
    requireProfileRequestReceipt(
      {
        id: "request-1",
        requested_city: "上海",
        requested_name: "新姓名",
        status: "pending",
      },
      { city: "上海", name: "新姓名", status: "pending" },
    ),
  );
});

test("管理员审核返回其它申请时必须失败", () => {
  assert.throws(
    () =>
      requireProfileRequestReceipt(
        { id: "request-2", status: "approved" },
        { requestId: "request-1", status: "approved" },
      ),
    /与当前操作不一致/,
  );
});

// 每次只改变一个字段，避免多个错误同时存在时掩盖缺失的身份/字段校验。
const submittedProfile = { city: "Shanghai", name: "Alice", userId: "user-1" };
const savedProfile = { city: "Shanghai", name: "Alice", user_id: "user-1" };
test("matching profile identity and submitted fields is a positive control", () => {
  assert.doesNotThrow(() => requireProfileWriteReceipt(savedProfile, submittedProfile));
});
for (const [field, wrong] of [["user_id", "user-2"], ["city", "Beijing"], ["name", "Bob"]]) {
  test(`profile receipt rejects an independently wrong ${field}`, () => {
    assert.throws(() => requireProfileWriteReceipt({ ...savedProfile, [field]: wrong }, submittedProfile));
  });
}

const submittedRequest = { city: "Shanghai", name: "Alice", requestId: "request-1", status: "pending" };
const savedRequest = { id: "request-1", requested_city: "Shanghai", requested_name: "Alice", status: "pending" };
test("matching request identity, status and submitted fields is a positive control", () => {
  assert.doesNotThrow(() => requireProfileRequestReceipt(savedRequest, submittedRequest));
});
for (const [field, wrong] of [["id", "request-2"], ["status", "approved"], ["requested_city", "Beijing"], ["requested_name", "Bob"]]) {
  test(`profile request rejects an independently wrong ${field}`, () => {
    assert.throws(() => requireProfileRequestReceipt({ ...savedRequest, [field]: wrong }, submittedRequest));
  });
}

// 只抽取本文件领域的夹具恢复函数；原E2E的账号/管理员import不会被加载或求值。
const receiptSpec = fs.readFileSync(new URL("../tests/e2e/profile-operation-receipts.spec.ts", import.meta.url), "utf8");
const receiptSyntax = ts.createSourceFile("profile-operation-receipts.spec.ts", receiptSpec, ts.ScriptTarget.Latest, true);
const restoreSource = receiptSyntax.statements
  .filter(node => ts.isFunctionDeclaration(node) && ["readProfileById", "restoreProfile"].includes(node.name.text))
  .map(node => node.getText(receiptSyntax)).join("\n");
const fixtureModule = { exports: {} };
vm.runInNewContext(ts.transpileModule(`${restoreSource}\nfixtureModule.exports=restoreProfile;`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, { fixtureModule }, { timeout: 2000 });
const restoreFixtureProfile = fixtureModule.exports;

/** 使用已安装SDK，只有REST传输和资料行是明确替身；不把这些用例计为原页面通过。 */
function profileCleanupFixture(options = {}) {
  const original = { user_id: "22222222-2222-4222-8222-222222222222", name: null, city: null, email: "fixture@example.test" };
  const expected = { name: "本次姓名", city: "本次城市" };
  const row = { ...original, ...expected }, requests = [];
  let reads = 0;
  const admin = createClient("http://profile-fixture.test", "synthetic-key", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input), method = init.method ?? "GET";
      assert.equal(url.pathname, "/rest/v1/user_profiles");
      requests.push(method);
      if (method === "PATCH") {
        options.beforePatch?.(row);
        const matches = ["user_id", "name", "city"].every(key => url.searchParams.get(key) === `eq.${row[key]}`);
        if (!matches || options.zeroWrite) return new Response(JSON.stringify({ code: "PGRST116", message: "no matching row" }), {
          status: 406, headers: { "content-type": "application/json", "content-range": "*/0" },
        });
        Object.assign(row, JSON.parse(init.body));
        if (options.emptyReceipt) return new Response("null", { headers: { "content-type": "application/json", "content-range": "0-0/1" } });
      } else {
        assert.equal(method, "GET"); reads++;
        if (reads === 2 && options.failReadback) return new Response('{"message":"readback unavailable"}', {
          status: 503, headers: { "content-type": "application/json" },
        });
      }
      const headers = { "content-type": "application/json" };
      if (!options.missingCount) headers["content-range"] = "0-0/1";
      return new Response(JSON.stringify(row), { headers });
    } },
  });
  return { original, expected, row, requests, restore: () => restoreFixtureProfile(admin, original, expected) };
}

test("资料夹具恢复空原值，并重复执行时不再改写", async () => {
  const fixture = profileCleanupFixture();
  await fixture.restore();
  assert.deepEqual(fixture.row, fixture.original);
  await fixture.restore();
  assert.equal(fixture.requests.filter(method => method === "PATCH").length, 1);
});

test("资料夹具不能覆盖另一处已经保存的新值", async () => {
  const fixture = profileCleanupFixture();
  fixture.row.name = "他处新值";
  await assert.rejects(fixture.restore(), /profile_test_ownership_changed/);
  assert.equal(fixture.row.name, "他处新值");
  assert.equal(fixture.requests.includes("PATCH"), false);
});

test("独立读取后出现交错修改时，恢复条件必须零命中", async () => {
  const fixture = profileCleanupFixture({ beforePatch: row => { row.name = "交错新值"; } });
  await assert.rejects(fixture.restore());
  assert.equal(fixture.row.name, "交错新值");
  assert.equal(fixture.row.city, fixture.expected.city);
});

for (const option of ["zeroWrite", "missingCount", "emptyReceipt", "failReadback"]) {
  test(`资料恢复的 ${option} 不能冒充清理已确认`, async () => {
    const fixture = profileCleanupFixture({ [option]: true });
    await assert.rejects(fixture.restore());
    assert.equal(fixture.row.name, option === "zeroWrite" ? fixture.expected.name : null);
  });
}
