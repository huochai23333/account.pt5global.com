import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const ownId = "b9000000-0000-4000-8000-000000000001";
function harness(options = {}) {
  const model = { row: options.existing ?? null, queries: [], deleted: 0 };
  const fixture = {},
    context = vm.createContext({});
  const initial = () => ({
    id: ownId,
    original_currency: "USD",
    target_currency: "CNY",
    daily_exchange_rate: 7,
    rate_date: "2026-11-09",
    source: "nowapi",
    provider_rate_date: "2026-11-09",
    bank_code: "BOC",
    bank_quote: 700,
    quote_type: "spot_buy",
    is_day_final: true,
    created_at: "2026-11-10T08:00:00+00:00",
    fetched_at: "2026-11-10T08:00:00+00:00",
    provider_updated_at: "2026-11-09T00:01:00+08:00",
    _xmin: "100",
  });
  const runtime = {
    State: { Running: true },
    Config: {
      Labels: { "com.supabase.cli.project": "pt5-e2e-quote-unit" },
      Env: [
        "SUPABASE_INTERNAL_FUNCTIONS_CONFIG=" +
          JSON.stringify({
            "exchange-rate-sync": {
              entrypointPath: "functions/exchange-rate-sync/index.ts",
              env: options.workerEnv ?? {},
            },
          }),
        ...(options.runtimeEnv ?? []),
      ],
    },
  };
  const sql = (input) => {
    model.queries.push(input);
    if (input === "select 1;") return "1";
    if (input.includes("select public.current_exchange_rate_date()"))
      return "2026-11-09";
    if (input.startsWith("select coalesce")) {
      const found = input.includes("where id=")
        ? model.row?.id === ownId
        : model.row?.rate_date === "2026-11-09";
      return JSON.stringify(found ? model.row : null);
    }
    if (input.startsWith("insert into public.exchange_rate")) {
      if (options.beforeInsertError) throw Error("before-insert");
      model.row = initial();
      if (options.current)
        Object.assign(model.row, { source: "manual", is_day_final: false });
      if (options.loseReceipt) throw Error("insert-receipt-lost");
      return JSON.stringify(model.row);
    }
    if (input.startsWith("begin;")) {
      assert(input.includes("for update"));
      assert(
        input.includes("ref.key_count<>1") &&
          input.includes("quote_fixture_referenced"),
      );
      if (options.cleanupError) throw Error("cleanup-failed");
      if (!options.keepRow) model.row = null;
      model.deleted++;
      return JSON.stringify(options.receipt ?? { id: ownId, deleted: 1 });
    }
    throw Error("unexpected_quote_sql");
  };
  Object.assign(context, {
    exports: fixture,
    process: {
      env: {
        PT5_E2E_DATABASE_PROJECT: options.project ?? "pt5-e2e-quote-unit",
      },
    },
    require: (name) => {
      if (name === "node:assert/strict") return assert;
      if (name === "node:crypto") return { randomUUID: () => ownId };
      if (name === "node:child_process")
        return {
          execFileSync: () => JSON.stringify([options.runtime ?? runtime]),
        };
      if (name === "./local-supabase") return { runLocalSupabaseSql: sql };
      if (name === "./local-postgres-query")
        return {
          localSqlValue: (value) => "'" + value.replaceAll("'", "''") + "'",
        };
      throw Error("unexpected_quote_dependency:" + name);
    },
  });
  vm.runInContext(
    ts.transpileModule(
      fs.readFileSync(
        new URL(
          "../../tests/e2e/helpers/current-exchange-rate-fixture.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
          esModuleInterop: true,
        },
      },
    ).outputText,
    context,
    { timeout: 2000 },
  );
  const state = fixture.createQuoteFixture("2026-11-09", true);
  return { fixture, model, state, initial };
}

test("报价日期在SQL前校验，不能重复准备或碰撞已有编号", () => {
  const h = harness();
  for (const date of [
    "",
    "2026-02-30",
    "2026-13-01",
    "2026-1-01",
    "2026-11-09';delete",
  ])
    assert.throws(() => h.fixture.createQuoteFixture(date));
  assert.equal(h.model.queries.length, 0);
  h.fixture.prepareQuoteFixture(h.state);
  assert.throws(
    () => h.fixture.prepareQuoteFixture(h.state),
    /prepare_repeated/,
  );
});

test("已有报价只登记完整快照，不覆盖或删除；版本改变明确拒绝", () => {
  const original = harness().initial();
  original.id = "b9000000-0000-4000-8000-000000000002";
  original.daily_exchange_rate = 7.2;
  original.bank_quote = 720;
  const h = harness({ existing: original });
  assert.equal(h.fixture.prepareQuoteFixture(h.state).id, original.id);
  assert.equal(h.fixture.cleanupQuoteFixture(h.state).deleted, 0);
  assert.equal(
    h.model.queries.some(
      (q) => q.startsWith("insert") || q.startsWith("begin;"),
    ),
    false,
  );
  h.model.row._xmin = "101";
  assert.throws(
    () => h.fixture.cleanupQuoteFixture(h.state),
    /existing_changed/,
  );
});

test("自有报价完整确认、锁内删除及独立读回，重复清理零影响", () => {
  const h = harness();
  h.fixture.prepareQuoteFixture(h.state);
  assert.equal(h.state.proof.id, ownId);
  assert.equal(h.fixture.cleanupQuoteFixture(h.state).deleted, 1);
  assert.equal(h.fixture.cleanupQuoteFixture(h.state).deleted, 0);
  assert.equal(h.model.deleted, 1);
  h.model.row = h.initial();
  assert.throws(() => h.fixture.cleanupQuoteFixture(h.state), /reappeared/);
});

test("提交丢回执保留未确认报价，提交前失败才可确认无写入", () => {
  const lost = harness({ loseReceipt: true });
  assert.throws(
    () => lost.fixture.prepareQuoteFixture(lost.state),
    /receipt-lost/,
  );
  assert.throws(
    () => lost.fixture.cleanupQuoteFixture(lost.state),
    /insert_unconfirmed/,
  );
  assert.equal(lost.model.deleted, 0);
  assert.equal(lost.model.row.id, ownId);
  const never = harness({ beforeInsertError: true });
  assert.throws(
    () => never.fixture.prepareQuoteFixture(never.state),
    /before-insert/,
  );
  assert.equal(never.fixture.cleanupQuoteFixture(never.state).deleted, 0);
});

test("已确认报价的字段或同值新版本不能收编，错误回执和残留均不能显示完成", () => {
  for (const change of [
    (row) => (row._xmin = "200"),
    (row) => (row.bank_quote = 701),
    (row) => (row.rate_date = "2026-11-08"),
  ]) {
    const h = harness();
    h.fixture.prepareQuoteFixture(h.state);
    change(h.model.row);
    assert.throws(
      () => h.fixture.cleanupQuoteFixture(h.state),
      /scope_changed|identity_changed|date_changed/,
    );
    assert.equal(h.model.deleted, 0);
  }
  for (const options of [
    { receipt: {} },
    { receipt: { id: ownId, deleted: 0 } },
    { keepRow: true },
    { cleanupError: true },
  ]) {
    const h = harness(options);
    h.fixture.prepareQuoteFixture(h.state);
    assert.throws(() => h.fixture.cleanupQuoteFixture(h.state));
    assert.equal(h.state.cleaned, undefined);
  }
});

test("本地provider边界检查父环境和函数环境，不允许真实凭据或共享项目", () => {
  const clean = harness();
  clean.fixture.assertQuoteProviderUnavailable();
  for (const options of [
    { runtimeEnv: ["NOWAPI_APP_KEY=synthetic"] },
    { runtimeEnv: ["NOWAPI_SIGN=synthetic"] },
    { workerEnv: { NOWAPI_APP_KEY: "synthetic" } },
    { workerEnv: { NOWAPI_SIGN: "synthetic" } },
    { project: "pt5-dropshipping" },
    { runtime: { State: { Running: false } } },
  ])
    assert.throws(() =>
      harness(options).fixture.assertQuoteProviderUnavailable(),
    );
  const malformed = harness({
    runtime: {
      State: { Running: true },
      Config: {
        Labels: { "com.supabase.cli.project": "pt5-e2e-quote-unit" },
        Env: ["SUPABASE_INTERNAL_FUNCTIONS_CONFIG=synthetic-private-fragment"],
      },
    },
  });
  assert.throws(
    () => malformed.fixture.assertQuoteProviderUnavailable(),
    (error) => error.message === "quote_provider_config_unreadable",
  );
});

test("当前报价原调用合同返回异步清理函数，准备与清理两错均保留", async () => {
  const current = harness({ current: true });
  const cleanup = await current.fixture.prepareCurrentExchangeRateFixture();
  assert.equal(typeof cleanup, "function");
  assert.equal(await cleanup(), undefined);
  assert.equal(current.model.deleted, 1);
  const failed = harness({ loseReceipt: true, current: true });
  await assert.rejects(
    failed.fixture.prepareCurrentExchangeRateFixture(),
    (error) =>
      error.errors.length === 2 &&
      String(error.errors[0]).includes("receipt-lost") &&
      String(error.errors[1]).includes("insert_unconfirmed"),
  );
  assert.equal(failed.model.deleted, 0);
});

test("报价夹具支持原7.18样本，非法或超精度金额在任何SQL前拒绝", () => {
  const h = harness();
  assert.equal(h.state.rate, 7);
  const explicit = h.fixture.createQuoteFixture("2026-11-10", false, 7.18);
  assert.equal(explicit.rate, 7.18);
  assert.equal(explicit.source, "manual");
  for (const rate of [0, -1, NaN, Infinity, "7.18", 7.1234567]) {
    assert.throws(
      () => h.fixture.createQuoteFixture("2026-11-10", false, rate),
      /rate_invalid/,
    );
  }
  h.state.rate = "7);delete from public.exchange_rate;--";
  assert.throws(() => h.fixture.prepareQuoteFixture(h.state), /rate_invalid/);
  assert.equal(h.model.queries.length, 0);
});
