import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { createBocManualRateCase } from "../../tests/test-support/boc-manual-rate-case.ts";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";

const date = "2026-09-20",
  id = "b1000000-0000-4000-8000-000000000002";
function row(rate = 7, version = "100") {
  return {
    id,
    original_currency: "XTS",
    target_currency: "CNY",
    rate_date: date,
    source: "manual",
    bank_code: "BOC",
    quote_type: "spot_buy",
    daily_exchange_rate: rate,
    bank_quote: rate * 100,
    provider_rate_date: date,
    provider_updated_at: `${date}T00:0${rate === 7 ? 1 : 2}:00+08:00`,
    created_at: "2026-11-11T00:00:00Z",
    fetched_at: "2026-11-11T00:00:00Z",
    is_day_final: false,
    _xmin: version,
  };
}
/** 内存端口只检查凭证/未知响应分支；真实FK、行锁和DELETE影响另在专属PG核对。 */
function harness(initial = []) {
  let rows = initial,
    calls = 0;
  const modes = {};
  const fixture = createBocManualRateCase((sql) => {
    calls++;
    if (sql.startsWith("begin;")) {
      if (modes.zero) throw Error("boc_manual_cleanup_zero_affected");
      if (modes.conflict) throw Error("boc_manual_cleanup_version_changed");
      rows = [];
      if (modes.lost) throw Error("reply lost after commit");
      return JSON.stringify({ id, deleted: 1 });
    }
    return JSON.stringify(rows);
  }, date);
  return {
    fixture,
    modes,
    get rows() {
      return rows;
    },
    set rows(value) {
      rows = value;
    },
    get calls() {
      return calls;
    },
  };
}
test("无效或归一化日期先拒绝，未准备清理零访问", () => {
  let calls = 0;
  for (const value of ["2026-02-30", "2026-13-20", "bad"])
    assert.throws(
      () =>
        createBocManualRateCase(() => {
          calls++;
          return "";
        }, value),
      /date_invalid/,
    );
  const h = harness();
  assert.equal(h.fixture.cleanup().deleted, 0);
  assert.equal(h.calls, 0);
  assert.equal(calls, 0);
});
test("原XTS行存在时准备拒绝且不删除，无论来源是否manual", () => {
  for (const source of ["manual", "nowapi"]) {
    const existing = row();
    existing.source = source;
    const h = harness([existing]);
    assert.throws(() => h.fixture.prepare(), /scope_occupied/);
    assert.equal(h.rows.length, 1);
    assert.equal(h.calls, 1);
  }
});
test("完整原始报价7和更新8必须同编号且新xmin；副本不能修改期望", () => {
  const h = harness();
  h.fixture.prepare();
  h.rows = [row()];
  const saved = h.fixture.saved();
  saved.source = "changed";
  h.fixture.unchanged();
  h.rows = [row(8, "101")];
  const updated = h.fixture.updated();
  updated._xmin = "999";
  h.fixture.evidence().last._xmin = "999";
  h.fixture.unchanged();
  assert.equal(h.fixture.cleanup().deleted, 1);
  assert(h.fixture.evidence().cleaned);
});
test("报价属性、业务日、发布时间、单位或编号不符不能接纳", () => {
  for (const change of [
    { source: "nowapi" },
    { bank_quote: 7 },
    { provider_rate_date: "2026-09-19" },
    { provider_updated_at: "bad" },
    { id: "bad" },
    { _xmin: 100 },
  ]) {
    const h = harness();
    h.fixture.prepare();
    h.rows = [{ ...row(), ...change }];
    assert.throws(() => h.fixture.saved(), /record_invalid/);
    assert.throws(() => h.fixture.cleanup(), /version_changed/);
  }
});
test("未变xmin或无关字段变化不能接纳为已修改", () => {
  for (const change of [
    { _xmin: "100" },
    { created_at: "2027-01-01T00:00:00Z" },
  ]) {
    const h = harness();
    h.fixture.prepare();
    h.rows = [row()];
    h.fixture.saved();
    h.rows = [{ ...row(8, "101"), ...change }];
    assert.throws(() => h.fixture.updated(), /identity_or_version/);
  }
});
test("UI真删除须独立为零；未删除不接纳成功，刷新后再查零", () => {
  const h = harness();
  h.fixture.prepare();
  h.rows = [row()];
  h.fixture.saved();
  assert.throws(() => h.fixture.deleted(), /not_final/);
  h.rows = [];
  assert.equal(h.fixture.deleted().deleted, 1);
  h.fixture.unchanged();
  assert.equal(h.fixture.cleanup().deleted, 0);
  assert(h.fixture.evidence().cleaned);
});
test("SQL零影响或锁内冲突保留未完成", () => {
  for (const mode of ["zero", "conflict"]) {
    const h = harness();
    h.fixture.prepare();
    h.rows = [row()];
    h.fixture.saved();
    h.modes[mode] = true;
    assert.throws(() => h.fixture.cleanup(), /zero_affected|version_changed/);
    assert.equal(h.fixture.evidence().cleaned, false);
    assert.equal(h.rows.length, 1);
  }
});
test("清理提交回包丢失不报成功，也不接受空图重置凭证", () => {
  const h = harness();
  h.fixture.prepare();
  h.rows = [row()];
  h.fixture.saved();
  h.modes.lost = true;
  assert.throws(() => h.fixture.cleanup(), /reply lost/);
  assert.equal(h.rows.length, 0);
  assert.equal(h.fixture.evidence().cleaned, false);
  assert.throws(() => h.fixture.cleanup(), /version_changed/);
});

// 只抽取当前收尾函数，不加载它所在文件的原Auth/管理员import。
function finalizer() {
  const file = "tests/e2e/helpers/boc-manual-rate-page.ts",
    root = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
    );
  const fn = root.statements.find(
    (n) =>
      ts.isFunctionDeclaration(n) &&
      n.name?.text === "finalizeBocManualRateCase",
  );
  assert(fn);
  return new Function(
    "cleanupFixtureResources",
    ts.transpileModule(fn.getText(root).replace("export ", ""), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText + ";return finalizeBocManualRateCase;",
  )(cleanupFixtureResources);
}
test("正文/清理/附件失败一起保留，关闭成功后才清理", async () => {
  const calls = [],
    body = Error("body"),
    cleanup = Error("cleanup"),
    attach = Error("attach");
  await assert.rejects(
    finalizer()(
      {
        isClosed: () => false,
        unrouteAll: async () => calls.push("drain"),
        close: async () => calls.push("close"),
      },
      {
        attach: async () => {
          calls.push("attach");
          throw attach;
        },
      },
      {
        cleanup: () => {
          calls.push("cleanup");
          throw cleanup;
        },
        evidence: () => ({}),
      },
      { error: body },
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
test("关闭失败禁止清理，仍保存未完成附件", async () => {
  let attached = false,
    cleaned = false;
  const close = Error("close");
  await assert.rejects(
    finalizer()(
      {
        isClosed: () => false,
        unrouteAll: async () => {},
        close: async () => {
          throw close;
        },
      },
      {
        attach: async () => {
          attached = true;
        },
      },
      {
        cleanup: () => {
          cleaned = true;
        },
        evidence: () => ({}),
      },
    ),
    (e) =>
      e instanceof AggregateError &&
      e.errors[0] === close &&
      e.errors[1].message === "boc_manual_page_not_closed",
  );
  assert(attached);
  assert.equal(cleaned, false);
});
