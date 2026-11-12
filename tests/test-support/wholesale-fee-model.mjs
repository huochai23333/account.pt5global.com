import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
const initial = JSON.parse(
  fs.readFileSync(
    new URL("./fixtures/wholesale-fee-proof-samples.json", import.meta.url),
    "utf8",
  ),
).states.created;
const stages = JSON.parse(
  fs.readFileSync(
    new URL(
      "./fixtures/wholesale-fee-transition-samples.json",
      import.meta.url,
    ),
    "utf8",
  ),
).states;
const prefix = "fees-e2e-b1000000-0000-4000-8000-000000000001",
  actor = "11111111-1111-4111-8111-111111111111",
  first = "b1000000-0000-4000-8000-000000000002",
  second = "b1000000-0000-4000-8000-000000000003";
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

/** 真实当前模块共用一个JSON环境；明确固定模型时钟，历史快照不参与任何真实业务写入。 */
export function createFeeModel(options = {}) {
  class FixtureDate extends Date {
    constructor(value = "2026-11-10T09:14:25Z") {
      super(value);
    }
    static now() {
      return Date.parse("2026-11-10T09:14:25Z");
    }
  }
  const model = { proof: empty(), deletions: 0, faultWrites: 0, ...options },
    context = vm.createContext({ Date: FixtureDate }),
    modules = {};
  const run = (input) => {
    if (input.startsWith("select coalesce(jsonb_agg(to_jsonb(o)"))
      return JSON.stringify(model.proof.order ? [model.proof.order] : []);
    if (input.startsWith("select coalesce(jsonb_agg(to_jsonb(v)"))
      return JSON.stringify(model.versions);
    if (input.startsWith("select jsonb_build_object('order'"))
      return JSON.stringify(model.proof);
    if (input.includes("create temp table fee_fault_input")) {
      model.faultWrites++;
      const match = /"amount":(50|51)/.exec(input);
      assert(match);
      const amount = Number(match[1]);
      if (amount === 51 && model.failFaultBefore)
        throw Error("fault-before-write");
      if (amount === 50 && model.failRestoreOnce) {
        model.failRestoreOnce = false;
        throw Error("restore-before-write");
      }
      if (
        (amount === 51 && model.zeroFault) ||
        (amount === 50 && model.zeroRestore)
      )
        return JSON.stringify({ affected: 0 });
      model.proof = structuredClone(model.proof);
      Object.assign(model.proof.commissions[0], {
        commission_amount_rmb: amount,
        _xmin: String(100000 + model.faultWrites),
      });
      if (amount === 51 && model.loseFaultReceipt)
        throw Error("fault-receipt-lost");
      if (amount === 50 && model.loseRestoreReceipt)
        throw Error("restore-receipt-lost");
      const receiptProof = structuredClone(model.proof);
      if (
        (amount === 51 && model.foreignAfterFaultReceipt) ||
        (amount === 50 && model.foreignAfterRestoreReceipt)
      ) {
        model.proof.commissions[0]._xmin = String(200000 + model.faultWrites);
      }
      return JSON.stringify({
        affected: (
          amount === 51 ? model.badFaultReceipt : model.badRestoreReceipt
        )
          ? 0
          : 1,
        proof: receiptProof,
      });
    }
    assert(input.includes("create temp table fee_cleanup_input"));
    const id = model.proof.order.id;
    model.proof = empty();
    model.deletions++;
    return JSON.stringify({ deleted: 1, orderId: id });
  };
  const entries = [
    ["calendar", "tests/test-support/shanghai-calendar.ts"],
    ["database", "tests/e2e/helpers/wholesale-fee-database.ts"],
    ["orders", "tests/e2e/helpers/wholesale-fee-order-fixture.ts"],
    ["transitions", "tests/e2e/helpers/wholesale-fee-order-transitions.ts"],
    ["fault", "tests/e2e/helpers/wholesale-fee-commission-fault.ts"],
  ];
  for (const [name, file] of entries) {
    const exports = {};
    modules[name] = exports;
    Object.assign(context, {
      exports,
      require: (dependency) => {
        if (dependency === "node:assert/strict") return assert;
        if (dependency === "./local-supabase")
          return { runLocalSupabaseSql: run };
        if (dependency === "../../test-support/shanghai-calendar")
          return modules.calendar;
        if (dependency === "./wholesale-fee-database") return modules.database;
        if (dependency === "./wholesale-fee-order-fixture")
          return modules.orders;
        throw Error("unexpected_transition_dependency:" + dependency);
      },
    });
    vm.runInContext(
      compile(
        fs.readFileSync(new URL("../../" + file, import.meta.url), "utf8"),
      ),
      context,
      {
        timeout: 2000,
      },
    );
  }
  context.exports = modules.transitions;
  vm.runInContext(
    "exports.registerJson=(operation,text)=>operation.register(JSON.parse(text));",
    context,
    { timeout: 2000 },
  );
  const state = modules.orders.createFeeOrderFixture(
      prefix,
      "new",
      initial.order.customer_id,
      actor,
      "new",
    ),
    payload = modules.orders.feeOrderCreatePayload(
      state,
      initial.order.creation_request_id,
    );
  modules.orders.registerFeeOrderRequest(state, payload);
  const copy = (value) =>
    JSON.parse(JSON.stringify(value).replaceAll("probe-fees-new", state.note));
  model.versions = [
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
  model.proof = copy(initial);
  modules.orders.confirmFeeOrder(state);
  const register = (operation, payload) =>
    modules.transitions.registerJson(operation, JSON.stringify(payload));
  const body = (amount, request) => ({
    p_order_id: state.proof.order.id,
    p_settlement_amount: amount,
    p_settlement_request_id: request,
    p_settlement_date: "2026-11-10",
  });
  const publish = (stage, request) => {
    model.proof = copy(stages[stage]);
    if (stage === "settled3000")
      model.proof.settlements[0].settlement_request_id = request;
    else {
      model.proof.settlements[0].settlement_request_id = first;
      model.proof.settlements[1].settlement_request_id = second;
    }
  };
  const partial = () => {
    const op = modules.transitions.beginFeeSettlement(state, 3000);
    register(op, body(3000, first));
    publish("settled3000", first);
    op.confirm();
  };
  const full = () => {
    partial();
    const op = modules.transitions.beginFeeSettlement(state, 9300);
    register(op, body(9300, second));
    publish("settled9300", second);
    op.confirm();
  };
  const costBody = () => {
    const payload = {
      ...modules.orders.feeOrderCreatePayload(state, "unused"),
      p_order_id: state.proof.order.id,
      p_product_purchase_amount: 11000,
    };
    delete payload.p_creation_request_id;
    return payload;
  };
  return {
    model,
    state,
    modules,
    register,
    body,
    publish,
    partial,
    full,
    costBody,
  };
}

export {
  actor as feeModelActor,
  first as feeModelFirstRequest,
  second as feeModelSecondRequest,
};
