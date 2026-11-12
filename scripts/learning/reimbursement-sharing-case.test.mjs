import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import {
  createReimbursementSharingCase,
  sharingOwnerId,
} from "../../tests/test-support/reimbursement-sharing-case.ts";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";

/** 此内存端口仅检查未知/冲突响应处理；正式函数、RLS及实际删除另在专属PG执行。 */
function harness() {
  let rows = [],
    calls = 0,
    loseReply = false,
    conflict = false;
  const execute = (sql) => {
    calls++;
    if (sql.includes("insert into public.operator_reimbursements(id,")) {
      rows = [
        ...sql.matchAll(
          /\('([a-f0-9-]+)','([a-f0-9-]+)','(\d{4}-\d{2}-\d{2})','([^']+)',(\d+)\)/g,
        ),
      ]
        .map((match) => {
          const [, id, owner, spent, content, amount] = match,
            boundary = content.endsWith("上海时间边界");
          const period = spent < "2024-08-25" ? "2024-07-25" : "2024-08-25";
          return {
            record: {
              id,
              operator_user_id: owner,
              spent_at: spent,
              content,
              amount: Number(amount),
              reimbursement_period_start: period,
              reimbursement_period_end:
                period === "2024-07-25" ? "2024-08-24" : "2024-09-24",
              status: boundary ? "reimbursed" : "unreimbursed",
              reimbursed_at: boundary ? "2026-09-08T16:30:00+00:00" : null,
              reimbursed_by_user_id: boundary ? owner : null,
              created_at: "2026-11-11T00:00:00Z",
              updated_at: boundary
                ? "2026-09-08T16:30:00Z"
                : "2026-11-11T00:00:00Z",
            },
            version: "100",
          };
        })
        .sort((a, b) => a.record.id.localeCompare(b.record.id));
      assert.equal(rows.length, 209);
      return "";
    }
    if (sql.includes("get diagnostics changed=row_count")) {
      if (conflict) throw Error("sharing_fixture_cleanup_version_changed");
      const deleted = rows.length;
      rows = [];
      if (loseReply) throw Error("reply lost after commit");
      return JSON.stringify({ deleted });
    }
    if (sql.includes("where operator_user_id="))
      return JSON.stringify(
        rows.filter(
          (row) =>
            row.record.operator_user_id === sharingOwnerId &&
            row.record.reimbursement_period_start === "2024-07-25",
        ),
      );
    return JSON.stringify(rows);
  };
  const fixture = createReimbursementSharingCase(execute);
  return {
    fixture,
    get rows() {
      return rows;
    },
    set rows(value) {
      rows = value;
    },
    get calls() {
      return calls;
    },
    loseReply() {
      loseReply = true;
    },
    conflict() {
      conflict = true;
    },
  };
}
function finish(h) {
  for (const row of h.rows.filter(
    (row) =>
      row.record.operator_user_id === sharingOwnerId &&
      row.record.reimbursement_period_start === "2024-07-25",
  )) {
    Object.assign(row.record, {
      status: "reimbursed",
      reimbursed_at: "2026-11-11T01:00:00Z",
      reimbursed_by_user_id: sharingOwnerId,
      updated_at: "2026-11-11T01:00:00Z",
    });
    row.version = "101";
  }
}
test("未启动夹具不查询或删除；不同场景生成不同UUID意图", () => {
  const a = harness(),
    b = harness();
  assert.notEqual(a.fixture.marker, b.fixture.marker);
  assert.equal(a.fixture.cleanup().deleted, 0);
  assert.equal(a.calls, 0);
  assert.throws(() => a.fixture.unchanged(), /not_active/);
});
test("209条完整凭证和周期独占，返回副本不会修改内部基准", () => {
  const h = harness(),
    saved = h.fixture.seed();
  saved[0].record.content = "changed copy";
  const proof = h.fixture.evidence();
  proof.captured[0].version = "999";
  assert.equal(h.fixture.unchanged().length, 209);
  h.fixture.assertPeriodOwned();
  assert.deepEqual(h.fixture.cleanup(), { deleted: 209 });
  assert.equal(h.fixture.evidence().cleanupConfirmed, true);
  assert.throws(() => h.fixture.seed(), /seed_repeated/);
});
test("少删或误删其他条目不能确认为竞态删除成功", () => {
  const h = harness();
  h.fixture.seed();
  assert.throws(() => h.fixture.deleted(), /delete_not_final/);
  h.rows = h.rows.filter((row) => !row.record.content.endsWith("其他周期"));
  assert.throws(() => h.fixture.deleted(), /delete_not_final/);
  assert.throws(() => h.fixture.cleanup(), /version_changed/);
});
test("实际删除指定一条后按208条新凭证回收，不能重复确认删除", () => {
  const h = harness();
  h.fixture.seed();
  h.rows = h.rows.filter((row) => !row.record.content.endsWith("竞态删除"));
  assert.equal(h.fixture.deleted().remaining, 208);
  assert.throws(() => h.fixture.deleted(), /delete_repeated/);
  assert.deepEqual(h.fixture.cleanup(), { deleted: 208 });
});
test("报销须205条终态且同事/其他周期完整不变", () => {
  const h = harness();
  h.fixture.seed();
  finish(h);
  assert.equal(h.fixture.reimbursed().updated, 205);
  h.fixture.unchanged();
  assert.deepEqual(h.fixture.cleanup(), { deleted: 209 });
});
test("缺失终态、伪造时间、原xmin及错误确认人均拒绝", () => {
  for (const change of [
    (row) => (row.record.status = "unreimbursed"),
    (row) => (row.record.reimbursed_at = "invalid"),
    (row) => (row.version = "100"),
    (row) => (row.record.reimbursed_by_user_id = "wrong"),
  ]) {
    const h = harness();
    h.fixture.seed();
    finish(h);
    change(
      h.rows.find(
        (row) =>
          row.record.operator_user_id === sharingOwnerId &&
          row.record.reimbursement_period_start === "2024-07-25",
      ),
    );
    assert.throws(() => h.fixture.reimbursed(), /terminal_invalid/);
    assert.equal(h.fixture.evidence().cleanupConfirmed, false);
  }
});
test("同事或其他周期的同值新版本不能被报销操作掩盖", () => {
  const h = harness();
  h.fixture.seed();
  finish(h);
  h.rows.find((row) => row.record.content.endsWith("同事费用")).version = "102";
  assert.throws(() => h.fixture.reimbursed(), /other_scope_changed/);
});
test("读回与锁内版本冲突均拒绝清理", () => {
  const a = harness();
  a.fixture.seed();
  a.rows[0].version = "101";
  assert.throws(() => a.fixture.cleanup(), /version_changed/);
  const b = harness();
  b.fixture.seed();
  b.conflict();
  assert.throws(() => b.fixture.cleanup(), /version_changed/);
  assert.equal(b.rows.length, 209);
});
test("清理已提交但回包丢失时不报成功，也不将空图重新接纳", () => {
  const h = harness();
  h.fixture.seed();
  h.loseReply();
  assert.throws(() => h.fixture.cleanup(), /reply lost/);
  assert.equal(h.rows.length, 0);
  assert.equal(h.fixture.evidence().cleanupConfirmed, false);
  assert.throws(() => h.fixture.cleanup(), /version_changed/);
});

/** 只编译两个安全辅助文件，导入逐个白名单注入；原Auth和账号文件不参与加载。 */
function loadSafe(file, dependencies) {
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const compiled = { exports: {} };
  new Function("module", "exports", "require", code)(
    compiled,
    compiled.exports,
    (name) => {
      assert(Object.hasOwn(dependencies, name), name);
      return dependencies[name];
    },
  );
  return compiled.exports;
}
const gates = loadSafe("tests/e2e/helpers/reimbursement-sharing-pages.ts", {
  "@playwright/test": {},
});
function adapter(data) {
  return loadSafe("tests/e2e/helpers/reimbursement-sharing-fixture.ts", {
    "@playwright/test": { test: { extend: (value) => value } },
    "./local-supabase": {
      runLocalSupabaseSql: () => {
        throw Error("not executed");
      },
    },
    "../../test-support/reimbursement-sharing-case": {
      createReimbursementSharingCase: () => data,
    },
    "../../test-support/fixture-cleanup-sequence": { cleanupFixtureResources },
    "./reimbursement-sharing-pages": gates,
  }).test.sharingCase;
}
test("正文/清理/附件失败均保留，闸门释放在排空前发生", async () => {
  const calls = [],
    body = Error("body"),
    cleanup = Error("cleanup"),
    attach = Error("attach");
  let gate;
  const data = {
    seed() {},
    cleanup() {
      calls.push("cleanup");
      throw cleanup;
    },
    evidence: () => ({}),
  };
  await assert.rejects(
    adapter(data)(
      {
        page: {
          isClosed: () => false,
          async unrouteAll() {
            await gate.promise;
            calls.push("drain");
          },
          async close() {
            calls.push("close");
          },
        },
      },
      async (value) => {
        gate = value.createGate();
        throw body;
      },
      {
        config: { workers: 1 },
        async attach() {
          calls.push("attach");
          throw attach;
        },
      },
    ),
    (e) =>
      e instanceof AggregateError &&
      e.errors.length === 3 &&
      e.errors[0] === body &&
      e.errors[1] === cleanup &&
      e.errors[2] === attach,
  );
  assert.deepEqual(calls, ["drain", "close", "cleanup", "attach"]);
});
test("页面关闭失败仍尝试附件，禁止数据回收", async () => {
  const calls = [],
    close = Error("close");
  await assert.rejects(
    adapter({
      seed() {},
      cleanup() {
        calls.push("unsafe");
      },
      evidence: () => ({}),
    })(
      {
        page: {
          isClosed: () => false,
          unrouteAll: async () => {},
          close: async () => {
            throw close;
          },
        },
      },
      async () => {},
      {
        config: { workers: 1 },
        async attach() {
          calls.push("attach");
        },
      },
    ),
    (e) =>
      e instanceof AggregateError &&
      e.errors[0] === close &&
      e.errors[1].message === "sharing_fixture_page_not_closed",
  );
  assert.deepEqual(calls, ["attach"]);
});
