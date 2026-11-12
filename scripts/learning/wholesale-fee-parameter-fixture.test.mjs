import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";
const code = "wholesale_salesman_customer_commission",
  admin = "11111111-1111-4111-8111-111111111111",
  request = "b7000000-0000-4000-8000-000000000001";
const reason = "fees-e2e-a7000000-0000-4000-8000-000000000001-参数发布",
  config = { existing_customer_rate: 0.12, new_customer_service_fee_rate: 0.1 };
const baseline = {
  definition: {
    parameter_code: code,
    business_key: "wholesale",
    sort_order: 0,
    current_revision: 1,
    created_at: "2026-11-10T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
    retired_at: null,
    _xmin: "100",
  },
  versions: [
    {
      id: "a7000000-0000-4000-8000-000000000001",
      parameter_code: code,
      version_number: 1,
      config,
      effective_from: "2026-11-09T00:00:00Z",
      published_at: "2026-11-09T00:00:00Z",
      requested_effective_from: null,
      change_reason: "专属基线",
      published_by: admin,
      request_id: "b7000000-0000-4000-8000-000000000000",
      is_migration_baseline: true,
      cancelled_at: null,
      cancelled_by: null,
      _xmin: "101",
    },
  ],
};
const payload = {
  p_parameter_code: code,
  p_config: config,
  p_effective_from: null,
  p_change_reason: reason,
  p_expected_revision: 1,
  p_request_id: request,
};

/** 当前完整模块配明确JSON/SQL端口；JSON桥保持HTTP数据语义，不加载原账号/Auth文件。 */
function harness(change = {}) {
  const model = {
    current: structuredClone(baseline),
    writes: 0,
    queries: [],
    ...change,
  };
  const runWholesaleFeeSql = (input) => {
    model.queries.push(input);
    if (input.startsWith("select jsonb_build_object"))
      return JSON.stringify(model.current);
    model.writes++;
    if (model.writeError) throw model.writeError;
    const already = model.current.definition.current_revision === 1;
    if (!model.keepPublished)
      model.current = {
        definition: {
          ...baseline.definition,
          updated_at: "2026-11-10T00:00:02Z",
          _xmin: "104",
        },
        versions: structuredClone(baseline.versions),
      };
    return JSON.stringify(
      model.receipt ?? { restored: already ? 0 : 1, removed: already ? 0 : 1 },
    );
  };
  const file = new URL(
      "../../tests/e2e/helpers/wholesale-fee-parameter-fixture.ts",
      import.meta.url,
    ),
    text = fs.readFileSync(file, "utf8"),
    exports = {};
  vm.runInNewContext(
    ts.transpileModule(text, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }).outputText +
      ";exports.registerJson=(state,text)=>registerFeeParameterRequest(state,JSON.parse(text));",
    {
      exports,
      require: (name) => {
        if (name === "node:assert/strict") return assert;
        if (name === "./wholesale-fee-database")
          return {
            runWholesaleFeeSql,
            feeSqlValue: (value) => "'" + value.replaceAll("'", "''") + "'",
          };
        throw Error("unexpected_parameter_dependency:" + name);
      },
    },
    { timeout: 3000 },
  );
  const publish = () => {
    model.current = {
      definition: {
        ...baseline.definition,
        current_revision: 2,
        updated_at: "2026-11-10T00:00:01Z",
        _xmin: "102",
      },
      versions: [
        ...structuredClone(baseline.versions),
        {
          ...baseline.versions[0],
          id: "a7000000-0000-4000-8000-000000000002",
          version_number: 2,
          request_id: request,
          change_reason: reason,
          is_migration_baseline: false,
          published_at: "2026-11-10T00:00:01Z",
          effective_from: "2026-11-10T00:00:01Z",
          _xmin: "103",
        },
      ],
    };
  };
  const capture = () => exports.captureFeeParameterFixture(reason),
    register = (state, data = payload) =>
      exports.registerJson(state, JSON.stringify(data));
  return {
    model,
    exports,
    publish,
    capture,
    register,
    confirmed: () => {
      const state = capture();
      register(state);
      publish();
      exports.bindFeeParameterPublication(state);
      return state;
    },
  };
}

test("费用参数夹具拒绝旧公共理由与缺失基线", () => {
  const h = harness();
  assert.throws(
    () => h.exports.captureFeeParameterFixture("fees-e2e-123-参数发布"),
    /reason_invalid/,
  );
  h.model.current.definition = null;
  assert.throws(() => h.capture(), /baseline_missing/);
  assert.equal(h.model.writes, 0);
});

test("费用参数只登记页面原请求，错配置/理由/修订/编号变化均拒绝", () => {
  for (const patch of [
    { p_parameter_code: "other" },
    { p_config: { existing_customer_rate: 0.9 } },
    { p_change_reason: "其他" },
    { p_expected_revision: 0 },
    { p_request_id: null },
    { p_effective_from: "2027-01-01" },
  ]) {
    const h = harness();
    assert.throws(() => h.register(h.capture(), { ...payload, ...patch }));
    assert.equal(h.model.writes, 0);
  }
  const h = harness(),
    state = h.capture();
  h.register(state);
  assert.throws(
    () =>
      h.register(state, {
        ...payload,
        p_request_id: "b7000000-0000-4000-8000-000000000002",
      }),
    /request_id_changed/,
  );
});

test("费用发布绑定真实请求和完整旧版本，重复确认保持同一凭证", () => {
  const h = harness(),
    state = h.confirmed();
  assert.equal(state.published.definition.current_revision, 2);
  const first = h.exports.bindFeeParameterPublication(state);
  assert.equal(first.request_id, request);
  assert.equal(first.version_number, 2);
  assert.equal(h.model.writes, 0);
});

test("费用发布拒绝错发布人/配置/时间/取消状态和旧版本修改", () => {
  for (const patch of [
    { published_by: request },
    { config: { existing_customer_rate: 0.9 } },
    { published_at: "bad-time" },
    { cancelled_at: "2026-11-10" },
    { version_number: 3 },
    { requested_effective_from: "2027-01-01" },
  ]) {
    const h = harness(),
      state = h.capture();
    h.register(state);
    h.publish();
    Object.assign(h.model.current.versions[1], patch);
    assert.throws(() => h.exports.bindFeeParameterPublication(state));
    assert.equal(state.published, undefined);
  }
  const h = harness(),
    state = h.capture();
  h.register(state);
  h.publish();
  h.model.current.versions[0]._xmin = "changed";
  assert.throws(() => h.exports.bindFeeParameterPublication(state));
});

test("费用无发布时仅确认零变化，提交后未独立确认不得直接回收", () => {
  const h = harness(),
    state = h.capture();
  assert.equal(h.exports.restoreFeeParameterFixture(state).restored, 0);
  h.register(state);
  h.publish();
  assert.throws(
    () => h.exports.restoreFeeParameterFixture(state),
    /publication_unconfirmed/,
  );
  assert.equal(h.model.writes, 0);
});

test("费用正常恢复有1/1回执及独立旧版本，重复恢复返回0/0", () => {
  const h = harness(),
    state = h.confirmed();
  assert.equal(h.exports.restoreFeeParameterFixture(state).removed, 1);
  assert.equal(h.exports.restoreFeeParameterFixture(state).removed, 0);
  assert.equal(h.model.current.definition.current_revision, 1);
  assert.deepEqual(h.model.current.versions, baseline.versions);
  assert.equal(h.model.writes, 2);
});

test("费用不匹配回执和仍有已发布版本的读回不能显示恢复完成", () => {
  for (const change of [
    { receipt: {} },
    { receipt: { restored: 1, removed: 0 } },
    { keepPublished: true },
    { writeError: new Error("atomic-delete-failed") },
  ]) {
    const h = harness(change),
      state = h.confirmed();
    assert.throws(() => h.exports.restoreFeeParameterFixture(state));
  }
});

test("原费用afterAll的订单/客户清理失败仍继续核对参数，两个失败保留", async () => {
  const source = fs.readFileSync(
      new URL(
        "../../tests/e2e/wholesale-customer-commission-fees.spec.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    tree = ts.createSourceFile("fees.ts", source, ts.ScriptTarget.Latest, true);
  let callback;
  const visit = (n) => {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(tree) === "test.afterAll"
    )
      callback = n.arguments[0].getText(tree);
    ts.forEachChild(n, visit);
  };
  visit(tree);
  assert(callback);
  const fixtureModule = { exports: {} },
    events = [];
  vm.runInNewContext(
    ts.transpileModule("fixtureModule.exports=" + callback, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText,
    {
      fixtureModule,
      orderFixtures: [{}],
      customerFixture: {},
      historicalCustomerFixture: { historical: true },
      cleanupFeeOrder: () => {
        events.push("orders");
        throw Error("orders");
      },
      cleanupFeeCustomer: (state) => {
        if (state.historical) {
          events.push("history");
          return;
        }
        events.push("customer");
        throw Error("customer");
      },
      parameterFixture: {},
      cleanupFixtureResources,
      restoreFeeParameterFixture: () => events.push("parameter"),
    },
    { timeout: 2000 },
  );
  await assert.rejects(
    fixtureModule.exports(),
    (error) => error.errors.length === 2,
  );
  assert.deepEqual(events, ["orders", "history", "customer", "parameter"]);
});
