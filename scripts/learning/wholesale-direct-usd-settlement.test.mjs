import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { randomUUID } from "node:crypto";
import test from "node:test";
import ts from "typescript";
const copy = (value) => JSON.parse(JSON.stringify(value));
const initial = JSON.parse(
  fs.readFileSync(
    "tests/test-support/fixtures/wholesale-fee-proof-samples.json",
    "utf8",
  ),
).states.created;
const actor = "11111111-1111-4111-8111-111111111111";

/** 三个当前模块共用明确JSON端口；不加载账号、原认证或Docker，完整SQL链另作原生验证。 */
function harness(buyingRate = 7.18) {
  const model = { graph: { order: null }, writes: 0 };
  const modules = {},
    context = vm.createContext({});
  const quotes = {
    id: randomUUID(),
    rate_date: "2026-11-10",
    original_currency: "USD",
    target_currency: "CNY",
    bank_code: "BOC",
    quote_type: "spot_buy",
    daily_exchange_rate: buyingRate,
    bank_quote: buyingRate * 100,
    provider_updated_at: "2026-11-09T16:01:00+00:00",
    _xmin: "120",
  };
  const quote = {
    id: quotes.id,
    date: quotes.rate_date,
    rate: buyingRate,
    proof: copy(quotes),
  };
  const versions = [
    {
      id: initial.order.salesman_commission_parameter_version_id,
      parameter_code: "wholesale_salesman_customer_commission",
      config: {
        existing_customer_rate: 0.12,
        new_customer_service_fee_rate: 0.1,
      },
      _xmin: "100",
    },
    {
      id: initial.order.referral_amount_parameter_version_id,
      parameter_code: "wholesale_referral_order_amount_rate",
      config: { rate: 0.02 },
      _xmin: "101",
    },
  ];
  const data = {
    readFeeOrderProof: () => copy(model.graph),
    readFeeOrderVersions: () => copy(versions),
    findFeeOrders: () => (model.graph.order ? [copy(model.graph.order)] : []),
    runWholesaleFeeSql: () => {
      model.writes++;
      throw Error("unit_write_not_allowed");
    },
    buildFeeOrderCleanupSql: () => {
      throw Error("unit_cleanup_not_allowed");
    },
  };
  for (const [name, file] of [
    ["orders", "tests/e2e/helpers/wholesale-fee-order-fixture.ts"],
    ["transitions", "tests/e2e/helpers/wholesale-fee-order-transitions.ts"],
    ["direct", "tests/e2e/helpers/wholesale-direct-usd-settlement.ts"],
  ]) {
    const exports = {};
    modules[name] = exports;
    const require = (dependency) => {
      if (dependency === "node:assert/strict")
        return Object.assign((...args) => assert(...args), assert, {
          deepEqual: (a, b, message) =>
            assert.deepEqual(copy(a), copy(b), message),
        });
      if (dependency === "../../test-support/shanghai-calendar")
        return { shanghaiDate: () => "2026-11-10" };
      if (dependency === "./wholesale-fee-database") return data;
      if (dependency === "./wholesale-fee-order-fixture") return modules.orders;
      if (dependency === "./wholesale-fee-order-transitions")
        return modules.transitions;
      if (dependency === "./current-exchange-rate-fixture")
        return { readQuoteFixture: () => copy(quotes) };
      throw Error("禁止加载未声明依赖：" + dependency);
    };
    const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
        esModuleInterop: true,
      },
    }).outputText;
    Object.assign(context, { exports, require });
    vm.runInContext(
      `(function(exports,require){${code}\n})(exports,require)`,
      context,
      { timeout: 5000 },
    );
  }
  const state = modules.orders.createFeeOrderFixture(
    "fees-e2e-" + randomUUID(),
    "split-settlement",
    randomUUID(),
    actor,
    "new",
    "split-settlement",
  );
  const creation = modules.orders.feeOrderCreatePayload(state, randomUUID());
  vm.runInContext(
    "exports.registerJson=(state,text)=>exports.registerFeeOrderRequest(state,JSON.parse(text))",
    Object.assign(context, { exports: modules.orders }),
  );
  modules.orders.registerJson(state, JSON.stringify(creation));
  model.graph = copy(initial);
  Object.assign(
    model.graph.order,
    Object.fromEntries(
      Object.entries(creation).map(([key, value]) => [key.slice(2), value]),
    ),
    {
      packing_fee: 3,
      service_fee: 0.7,
      cn_tax_fee: 0.42,
      payment_processing_fee: 0.15,
    },
  );
  model.graph.order.commission_calculation_snapshot = copy(
    modules.orders.feeOrderSnapshot(model.graph.order, 0, 0),
  );
  Object.assign(model.graph.commissions[0], {
    customer_id: state.customer,
    calculation_snapshot: copy(
      model.graph.order.commission_calculation_snapshot,
    ),
  });
  modules.orders.confirmFeeOrder(state);
  const firstRequest = randomUUID(),
    secondRequest = randomUUID();
  // 独立固定期望：常规价、逐笔分舍入造成加权价不同、以及负毛利；不调用产品计算器生成答案。
  const amounts = new Map([
    [
      7.18,
      {
        rate: 7.1082,
        first: 710.82,
        total: 2132.46,
        profit: 2118.46,
        weighted: 7.1082,
      },
    ],
    [
      7.12345,
      {
        rate: 7.052216,
        first: 705.22,
        total: 2115.66,
        profit: 2101.66,
        weighted: 7.0522,
      },
    ],
    [
      0.01,
      {
        rate: 0.0099,
        first: 0.99,
        total: 2.97,
        profit: -11.03,
        weighted: 0.0099,
      },
    ],
  ]).get(buyingRate);
  const body = (amount, request) => ({
    p_order_id: state.proof.order.id,
    p_settlement_amount: amount,
    p_settlement_date: quote.date,
    p_settlement_request_id: request,
  });
  function begin(
    amount,
    request = amount === 100 ? firstRequest : secondRequest,
  ) {
    const action = modules.direct.beginDirectUsdSettlement(
      state,
      quote,
      amount,
      quote.date,
    );
    vm.runInContext(
      "exports.registerAction=(action,text)=>action.register(JSON.parse(text))",
      Object.assign(context, { exports: modules.direct }),
    );
    modules.direct.registerAction(
      action,
      JSON.stringify(body(amount, request)),
    );
    return action;
  }
  function commit(
    amount,
    request = amount === 100 ? firstRequest : secondRequest,
  ) {
    const full = amount === 200,
      time = full ? "2026-11-10T10:00:01+00:00" : "2026-11-10T10:00:00+00:00",
      xmin = full ? "701" : "700";
    const paid = full ? amounts.total : amounts.first,
      profit = full ? amounts.profit : 0,
      basis = full ? 0.7 : 0;
    Object.assign(model.graph.order, {
      status: full ? "settled" : "partial_settled",
      _xmin: xmin,
      updated_at: time,
      settled_at: time,
      settlement_exchange_rate: full
        ? amounts.weighted
        : Number((amounts.first / 100).toFixed(6)),
      customer_payment_rmb_amount: paid,
      gross_profit: full ? profit : null,
      gross_margin: full ? Number((profit / paid).toFixed(6)) : null,
      commission_basis_amount_rmb: basis,
    });
    model.graph.order.commission_calculation_snapshot = copy(
      modules.orders.feeOrderSnapshot(model.graph.order, profit, basis),
    );
    Object.assign(model.graph.commissions[0], {
      _xmin: xmin,
      calculated_at: time,
      commission_amount_rmb: full ? 0.07 : 0,
      commission_basis_amount_rmb: basis,
      gross_profit_rmb: profit,
      order_payment_rmb_amount: paid,
      calculation_snapshot: copy(
        model.graph.order.commission_calculation_snapshot,
      ),
    });
    model.graph.settlements.push({
      id: randomUUID(),
      order_id: state.proof.order.id,
      settlement_amount: amount,
      settlement_exchange_rate: amounts.rate,
      settlement_rmb_amount: full
        ? Number((amounts.total - amounts.first).toFixed(2))
        : amounts.first,
      settled_on: quote.date,
      settled_at: time,
      created_at: time,
      created_by_user_id: actor,
      source_settlement_release_id: null,
      exchange_rate_id: quotes.id,
      buying_exchange_rate: buyingRate,
      exchange_rate_quoted_at: quotes.provider_updated_at,
      settlement_request_id: request,
      _xmin: xmin,
    });
    model.graph.settlements.sort((a, b) => a.id.localeCompare(b.id));
  }
  return {
    modules,
    model,
    state,
    quote,
    quotes,
    begin,
    commit,
    body,
    firstRequest,
    secondRequest,
  };
}

test("原100+200美元完整图、报价和两笔版本核对通过，前一笔不变", () => {
  for (const rate of [7.18, 7.12345, 0.01]) {
    const h = harness(rate),
      first = h.begin(100);
    h.commit(100);
    first.confirm();
    const held = JSON.stringify(h.state.proof.settlements[0]);
    const second = h.begin(200);
    h.commit(200);
    second.confirm();
    assert.equal(h.state.proof.settlements.length, 2);
    assert(
      h.state.proof.settlements.some((row) => JSON.stringify(row) === held),
    );
    assert.equal(h.state.proof.order.status, "settled");
    assert.equal(h.state.proof.commissions[0].commission_amount_rmb, 0.07);
    assert.equal(h.model.writes, 0);
  }
});

test("空写入不因确认函数返回而成功，错单/金额/日期和编号重用在转发前拒绝", () => {
  const h = harness(),
    action = h.begin(100);
  assert.throws(() => action.confirm(), /not_written/);
  for (const changed of [
    { p_order_id: randomUUID() },
    { p_settlement_amount: 200 },
    { p_settlement_date: "2026-11-09" },
  ]) {
    const other = harness(),
      op = other.begin(100);
    assert.throws(
      () =>
        other.modules.direct.registerAction(
          op,
          JSON.stringify({
            ...other.body(100, other.firstRequest),
            ...changed,
          }),
        ),
      /payload_changed/,
    );
  }
  assert.throws(() => h.begin(200), /sequence_changed/);
  assert.equal(h.model.writes, 0);
});

test("明细缺失、重复、错报价、错金额和陌生子行不得绑定为本次结果", () => {
  for (const change of [
    (graph) => {
      graph.settlements = [];
    },
    (graph) => {
      graph.settlements.push(copy(graph.settlements[0]));
    },
    (graph) => {
      graph.settlements[0].exchange_rate_id = randomUUID();
    },
    (graph) => {
      graph.settlements[0].settlement_rmb_amount++;
    },
    (graph) => {
      graph.logs.push({ id: randomUUID(), _xmin: "700" });
    },
    (graph) => {
      graph.commissions[0].commission_amount_rmb = 1;
    },
  ]) {
    const h = harness(),
      op = h.begin(100);
    h.commit(100);
    change(h.model.graph);
    assert.throws(() => op.confirm());
    assert.equal(h.state.proof.settlements.length, 0);
    assert.equal(h.model.writes, 0);
  }
});

test("第二笔不能改写前笔；报价内容同值新版本仍拒绝且保留恢复入口", () => {
  const h = harness(),
    first = h.begin(100);
  h.commit(100);
  first.confirm();
  const second = h.begin(200);
  h.commit(200);
  h.model.graph.settlements.find(
    (row) => row.settlement_request_id === h.firstRequest,
  )._xmin = "foreign";
  assert.throws(() => second.confirm(), /previous_changed/);
  const q = harness(),
    op = q.begin(100);
  q.commit(100);
  q.quotes._xmin = "121";
  assert.throws(() => op.confirm(), /quote_changed/);
  assert(q.state.recover);
  assert.throws(
    () => q.modules.orders.cleanupFeeOrder(q.state),
    /quote_changed/,
  );
  assert.equal(q.model.writes, 0);
});

test("确认之后父版本变化不能重新绑定，重复恢复不增加明细", () => {
  const h = harness(),
    op = h.begin(100);
  h.commit(100);
  op.confirm();
  op.confirm();
  assert.equal(h.state.proof.settlements.length, 1);
  h.model.graph.order._xmin = "702";
  assert.throws(() => h.begin(200), /scope_changed/);
  assert.equal(h.model.writes, 0);
});

test("99%成交价按百万分舍入，非法报价不进入业务核对", () => {
  const h = harness(),
    rate = h.modules.direct.directUsdCompanyRate;
  for (const [input, expected] of [
    [7.18, 7.1082],
    [7.12345, 7.052216],
    [7.123456, 7.052221],
  ])
    assert.equal(rate(input), expected);
  for (const bad of [NaN, Infinity, 0, -1]) assert.throws(() => rate(bad));
});
