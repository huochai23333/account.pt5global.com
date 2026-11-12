import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { shanghaiDate } from "../../tests/test-support/shanghai-calendar.ts";
const samples = JSON.parse(
  fs.readFileSync(
    new URL(
      "../../tests/test-support/fixtures/wholesale-fee-proof-samples.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const prefix = "fees-e2e-a9000000-0000-4000-8000-000000000001",
  actor = "11111111-1111-4111-8111-111111111111";
const compile = (text) =>
  "(function(exports,require){" +
  ts.transpileModule(text, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText +
  "})(exports,require);";
const empty = () => ({
  order: null,
  commissions: [],
  settlements: [],
  logs: [],
  attachments: [],
  allocations: [],
});

/** 历史合成样本只作JSON端口数据；两个完整当前模块仍执行真实断言和SQL生成代码。 */
function harness(options = {}) {
  const original = samples.states.created,
    request = original.order.creation_request_id;
  const model = { proof: empty(), queries: [], deletions: 0, ...options },
    database = {},
    api = {},
    context = vm.createContext({});
  model.versions = [
    {
      id: original.order.salesman_commission_parameter_version_id,
      parameter_code: "wholesale_salesman_customer_commission",
      config: {
        existing_customer_rate: 0.12,
        new_customer_service_fee_rate: 0.1,
      },
      _xmin: "100",
    },
    {
      id: original.order.referral_amount_parameter_version_id,
      parameter_code: "wholesale_referral_order_amount_rate",
      config: { rate: 0.02 },
      _xmin: "101",
    },
  ];
  const run = (input) => {
    model.queries.push(input);
    if (input.startsWith("select coalesce(jsonb_agg(to_jsonb(o)"))
      return JSON.stringify(
        model.findRows ?? (model.proof.order ? [model.proof.order] : []),
      );
    if (input.startsWith("select coalesce(jsonb_agg(to_jsonb(v)"))
      return JSON.stringify(model.versions);
    if (input.startsWith("select jsonb_build_object('order'"))
      return JSON.stringify(model.proof);
    assert(input.includes("create temp table fee_cleanup_input"));
    model.deletions++;
    if (model.writeError) throw model.writeError;
    const id = model.proof.order.id;
    if (!model.keepOrder) model.proof = empty();
    return JSON.stringify(model.receipt ?? { deleted: 1, orderId: id });
  };
  Object.assign(context, {
    exports: database,
    require: (name) => {
      if (name === "node:assert/strict") return assert;
      if (name === "./local-supabase") return { runLocalSupabaseSql: run };
      throw Error("unexpected_order_store_dependency:" + name);
    },
  });
  vm.runInContext(
    compile(
      fs.readFileSync(
        new URL(
          "../../tests/e2e/helpers/wholesale-fee-database.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
    context,
    { timeout: 2000 },
  );
  Object.assign(context, {
    exports: api,
    require: (name) => {
      if (name === "node:assert/strict") return assert;
      if (name === "../../test-support/shanghai-calendar")
        return { shanghaiDate };
      if (name === "./wholesale-fee-database") return database;
      throw Error("unexpected_order_fixture_dependency:" + name);
    },
  });
  vm.runInContext(
    compile(
      fs.readFileSync(
        new URL(
          "../../tests/e2e/helpers/wholesale-fee-order-fixture.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ) +
      ";exports.registerJson=(state,text)=>exports.registerFeeOrderRequest(state,JSON.parse(text));",
    context,
    { timeout: 2000 },
  );
  const state = api.createFeeOrderFixture(
    prefix,
    "new",
    original.order.customer_id,
    actor,
    "new",
    options.sample ?? "fees",
  );
  const register = (body = api.feeOrderCreatePayload(state, request)) =>
    api.registerJson(state, JSON.stringify(body));
  const publish = () => {
    model.proof = structuredClone(original);
    Object.assign(model.proof.order, {
      notes: state.note,
      order_month: state.month,
    });
    if (state.sample === "creation-dedup") {
      // 独立样本明确列出原表单字段与金额期望，不用被测计算器生成费用。
      Object.assign(model.proof.order, {
        small_order_count: 1,
        product_purchase_amount: 100,
        international_shipping_fee: 20,
        other_fee: 3,
        referral_commission_fee: 2,
        courier_company: "DHL",
        customer_payment_currency: "USD",
        customer_payment_amount: 200,
        payment_platform: "Wise",
        packing_fee: 3,
        service_fee: 6.15,
        cn_tax_fee: 3.69,
        payment_processing_fee: 1.33,
      });
      model.proof.order.commission_calculation_snapshot.serviceFeeRmb = 6.15;
      model.proof.commissions[0].calculation_snapshot.serviceFeeRmb = 6.15;
    }
  };
  return {
    api,
    model,
    state,
    request,
    register,
    publish,
    confirmed: () => {
      register();
      publish();
      return api.confirmFeeOrder(state);
    },
  };
}

test("费用订单清单的前缀/种类/客户和创建人必须在SQL前有效", () => {
  const h = harness();
  for (const args of [
    ["fees-e2e-old", "new", h.state.customer, actor, "new"],
    [prefix, "new/unsafe", h.state.customer, actor, "new"],
    [prefix, "new", "not-uuid", actor, "new"],
    [prefix, "new", h.state.customer, "bad", "new"],
  ])
    assert.throws(() => h.api.createFeeOrderFixture(...args));
  assert.equal(h.model.queries.length, 0);
});
test("费用订单登记原请求再转发；内容/编号变化和旧请求碰撞均拒绝", () => {
  const h = harness(),
    body = h.api.feeOrderCreatePayload(h.state, h.request);
  h.register(body);
  h.register(body);
  for (const patch of [
    { p_notes: "other" },
    { p_customer_id: actor },
    { p_product_purchase_amount: 1 },
    { p_creation_request_id: actor },
    { unexpected: true },
  ])
    assert.throws(() => h.register({ ...body, ...patch }));
  const collision = harness();
  collision.publish();
  assert.throws(() => collision.register(), /preexisting/);
  assert.equal(collision.state.request, undefined);
});
test("费用订单首次完整绑定，并按同一父子行/参数版本重复核对", () => {
  const h = harness(),
    order = h.confirmed();
  assert.equal(order.status, "unsettled");
  assert.equal(order.service_fee, 500);
  assert.equal(h.api.confirmFeeOrder(h.state).id, order.id);
  assert.equal(h.state.proof.commissions.length, 1);
  assert.equal(h.state.parameterProof.length, 2);
  assert.equal(h.model.deletions, 0);
});
test("费用订单首次绑定拒绝改名/金额/修订、未知字段及错提成", () => {
  for (const patch of [
    { notes: "other" },
    { product_purchase_amount: 1 },
    { _xmin: null },
    { extra_column: true },
    { commission_rate: 0.9 },
    { status: "settled" },
  ]) {
    const h = harness();
    h.register();
    h.publish();
    Object.assign(h.model.proof.order, patch);
    assert.throws(() => h.api.confirmFeeOrder(h.state));
    assert.equal(h.state.proof, undefined);
  }
  const h = harness();
  h.register();
  h.publish();
  h.model.proof.commissions[0].beneficiary_user_id = actor;
  assert.throws(() => h.api.confirmFeeOrder(h.state), /commission_changed/);
});
test("费用订单首次绑定拒绝提前出现的结汇/日志/附件/分配", () => {
  for (const key of ["settlements", "logs", "attachments", "allocations"]) {
    const h = harness();
    h.register();
    h.publish();
    h.model.proof[key].push({ id: actor });
    assert.throws(() => h.api.confirmFeeOrder(h.state), /children_changed/);
    assert.equal(h.state.proof, undefined);
  }
});
test("费用订单规则来源必须是两份正确配置，确认后版本内容变化也拒绝", () => {
  for (const change of [
    (rows) => rows.pop(),
    (rows) => (rows[0].parameter_code = "other"),
    (rows) => (rows[0].config.existing_customer_rate = 0.9),
    (rows) => (rows[1].config.rate = 0.9),
  ]) {
    const h = harness();
    h.register();
    h.publish();
    change(h.model.versions);
    assert.throws(() => h.api.confirmFeeOrder(h.state));
    assert.equal(h.state.proof, undefined);
  }
  const h = harness();
  h.confirmed();
  h.model.versions[0]._xmin = "changed";
  assert.throws(() => h.api.confirmFeeOrder(h.state), /parameter_changed/);
});
test("费用订单丢回执后按已登记请求找回初始图，清理及重复均有凭证", () => {
  const h = harness();
  h.register();
  h.publish();
  assert.equal(h.state.proof, undefined);
  assert.equal(h.api.cleanupFeeOrder(h.state).deleted, 1);
  assert.equal(h.api.cleanupFeeOrder(h.state).deleted, 0);
  assert.equal(h.model.deletions, 1);
  assert.equal(h.model.proof.order, null);
});
test("费用订单未登记不查询，登记但未提交只确认零行", () => {
  const h = harness();
  assert.equal(h.api.cleanupFeeOrder(h.state).deleted, 0);
  assert.equal(h.model.queries.length, 0);
  h.register();
  assert.equal(h.api.cleanupFeeOrder(h.state).deleted, 0);
  assert.equal(h.model.deletions, 0);
});
test("费用订单确认后父行或提成变化不得作为新清理基线", () => {
  for (const change of [
    (proof) => (proof.order.notes = "changed"),
    (proof) => (proof.commissions[0]._xmin = "new-version"),
  ]) {
    const h = harness();
    h.confirmed();
    change(h.model.proof);
    assert.throws(() => h.api.cleanupFeeOrder(h.state), /scope_changed/);
    assert.equal(h.model.deletions, 0);
  }
});
test("费用订单错误/零影响回执、残留和SQL失败均不报告清理完成", () => {
  for (const options of [
    { receipt: {} },
    { receipt: { deleted: 0 } },
    { receipt: { deleted: 1, orderId: actor } },
    { keepOrder: true },
    { writeError: Error("write-failed") },
  ]) {
    const h = harness(options);
    h.confirmed();
    assert.throws(() => h.api.cleanupFeeOrder(h.state));
    assert.equal(h.state.deleted, undefined);
  }
});
test("费用订单已确认行消失或回收后重现，清理不得默默通过", () => {
  const missing = harness();
  missing.confirmed();
  missing.model.proof = empty();
  assert.throws(
    () => missing.api.cleanupFeeOrder(missing.state),
    /created_row_missing/,
  );
  const again = harness();
  again.confirmed();
  again.api.cleanupFeeOrder(again.state);
  again.publish();
  assert.throws(() => again.api.cleanupFeeOrder(again.state));
  assert.equal(again.model.deletions, 1);
});

test("原创建防重复USD样本保留完整输入，确认/重试及限定回收", () => {
  const h = harness({ sample: "creation-dedup" });
  const body = h.api.feeOrderCreatePayload(h.state, h.request);
  assert.equal(body.p_small_order_count, 1);
  assert.equal(body.p_product_purchase_amount, 100);
  assert.equal(body.p_international_shipping_fee, 20);
  assert.equal(body.p_other_fee, 3);
  assert.equal(body.p_referral_commission_fee, 2);
  assert.equal(body.p_courier_company, "DHL");
  assert.equal(body.p_customer_payment_currency, "USD");
  assert.equal(body.p_customer_payment_amount, 200);
  assert.equal(body.p_payment_platform, "Wise");
  const row = h.confirmed();
  assert.equal(row.service_fee, 6.15);
  assert.equal(row.cn_tax_fee, 3.69);
  assert.equal(row.payment_processing_fee, 1.33);
  const snapshot = JSON.stringify(h.state.proof);
  h.register();
  h.api.confirmFeeOrder(h.state);
  assert.equal(JSON.stringify(h.state.proof), snapshot);
  assert.equal(h.api.cleanupFeeOrder(h.state).deleted, 1);
  assert.equal(h.api.cleanupFeeOrder(h.state).deleted, 0);
});

test("创建防重复样本提交丢回执可回收，陌生字段/同值新版本不得重新绑定", () => {
  const lost = harness({ sample: "creation-dedup" });
  lost.register();
  lost.publish();
  assert.equal(lost.api.cleanupFeeOrder(lost.state).deleted, 1);
  for (const change of [
    (proof) => (proof.order.payment_platform = "other"),
    (proof) => (proof.order._xmin = "unknown-version"),
  ]) {
    const h = harness({ sample: "creation-dedup" });
    h.confirmed();
    change(h.model.proof);
    assert.throws(() => h.api.cleanupFeeOrder(h.state), /scope_changed/);
    assert.equal(h.model.deletions, 0);
  }
});

test("未知创建样本必须在任何SQL前拒绝", () => {
  const h = harness();
  assert.throws(
    () =>
      h.api.createFeeOrderFixture(
        prefix,
        "new",
        h.state.customer,
        actor,
        "new",
        "unknown",
      ),
    /sample_invalid/,
  );
  assert.equal(h.model.queries.length, 0);
});
