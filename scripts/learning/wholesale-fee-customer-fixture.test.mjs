import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { randomUUID } from "node:crypto";
const prefix = "fees-e2e-a8000000-0000-4000-8000-000000000001";
// 像真实CommonJS一样隔离每个模块局部变量，同时共享JSON对象所在的运行环境。
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

/** 两份当前完整源码共享JSON环境；仅SQL传输端口是模型，不执行任何账号/Auth或外部请求。 */
function harness(options = {}) {
  const model = {
      row: null,
      queries: [],
      insertions: 0,
      deletions: 0,
      ...options,
    },
    database = {},
    api = {},
    context = vm.createContext({});
  const initial = () => ({
    id: model.state.id,
    unique_name: model.state.name,
    registered_user_id: null,
    assigned_sales_user_id: "55555555-5555-4555-8555-555555555555",
    created_by_user_id: "11111111-1111-4111-8111-111111111111",
    customer_kind: "sales_created",
    other_names: [],
    contact_details: null,
    source: null,
    notes: null,
    salesman_commission_cohort: model.state.cohort,
    edit_revision: 1,
    created_at: model.historical
      ? "2026-10-06T16:00:00Z"
      : "2026-11-10T00:00:00Z",
    updated_at: "2026-11-10T00:00:00Z",
    _xmin: "100",
  });
  const emptyArchive = () => ({
    archives: [],
    folders: [],
    files: [],
    templates: [],
  });
  const initialArchive = () => {
    const id = randomUUID();
    return {
      archives: [
        {
          id,
          customer_id: model.state.id,
          user_id: null,
          kind: "customer",
          created_at: model.row.updated_at,
          _xmin: model.row._xmin,
        },
      ],
      folders: [
        {
          id: randomUUID(),
          archive_id: id,
          parent_id: null,
          zone: "personal",
          name: "资料文件夹",
          system_key: "personal",
          version: 1,
          created_at: model.row.updated_at,
          delete_batch_id: null,
          _xmin: model.row._xmin,
        },
      ],
      files: [],
      templates: [],
    };
  };
  const run = (input) => {
    model.queries.push(input);
    if (input.startsWith("select coalesce")) return JSON.stringify(model.row);
    if (input.startsWith("select jsonb_build_object"))
      return JSON.stringify(model.archive ?? emptyArchive());
    if (input.includes("insert into public.wholesale_customers")) {
      model.insertions++;
      if (model.insertBeforeError) throw Error("insert-before");
      model.row = initial();
      model.archive = initialArchive();
      if (model.insertAfterError) throw Error("insert-after");
      return JSON.stringify(model.row);
    }
    assert(input.includes("create temp table fee_customer_input"));
    model.deletions++;
    if (model.deleteError) throw Error("delete-failed");
    if (!model.keepRow) {
      model.row = null;
      if (!model.keepArchive) model.archive = emptyArchive();
    }
    return JSON.stringify(
      model.receipt ?? { deleted: 1, customerId: model.state.id },
    );
  };
  Object.assign(context, {
    exports: database,
    require: (name) => {
      if (name === "node:assert/strict") return assert;
      if (name === "./local-supabase") return { runLocalSupabaseSql: run };
      throw Error("unexpected_customer_store_dependency:" + name);
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
      if (name === "node:crypto") return { randomUUID };
      if (name === "./wholesale-fee-database") return database;
      throw Error("unexpected_customer_fixture_dependency:" + name);
    },
  });
  vm.runInContext(
    compile(
      fs.readFileSync(
        new URL(
          "../../tests/e2e/helpers/wholesale-fee-customer-fixture.ts",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
    context,
    { timeout: 2000 },
  );
  const state = model.historical
    ? api.createFeeHistoricalCustomerFixture(prefix)
    : api.createFeeCustomerFixture(prefix);
  model.state = state;
  return { model, api, state, initial };
}

test("费用客户先登记随机编号，旧前缀/公共名称在SQL前拒绝", () => {
  const h = harness();
  for (const value of [
    "fees-e2e-123",
    "wholesale-fees",
    "fees-e2e-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  ])
    assert.throws(
      () => h.api.createFeeCustomerFixture(value),
      /prefix_invalid/,
    );
  assert.match(h.state.id, /^[a-f0-9-]{36}$/);
  assert.equal(h.model.queries.length, 0);
});
test("费用客户正常准备全行读回，重复准备不得再次插入", () => {
  const h = harness(),
    row = h.api.prepareFeeCustomer(h.state);
  assert.equal(row.id, h.state.id);
  assert.equal(row.salesman_commission_cohort, "new");
  assert.equal(h.model.insertions, 1);
  assert.throws(() => h.api.prepareFeeCustomer(h.state), /already_attempted/);
  assert.equal(h.model.insertions, 1);
});
test("费用客户未尝试写入不查询，提交前失败只核对不存在", () => {
  const h = harness({ insertBeforeError: true });
  assert.equal(h.api.cleanupFeeCustomer(h.state).deleted, 0);
  assert.equal(h.model.queries.length, 0);
  assert.throws(() => h.api.prepareFeeCustomer(h.state), /insert-before/);
  assert.equal(h.state.attempted, true);
  assert.equal(h.api.cleanupFeeCustomer(h.state).deleted, 0);
  assert.equal(h.model.deletions, 0);
});
test("费用客户插入丢回执可按完整初始形状回收，确认后重试不再写入", () => {
  const h = harness({ insertAfterError: true });
  assert.throws(() => h.api.prepareFeeCustomer(h.state), /insert-after/);
  assert.equal(h.state.proof, undefined);
  assert.equal(h.api.cleanupFeeCustomer(h.state).deleted, 1);
  assert.equal(h.api.cleanupFeeCustomer(h.state).deleted, 0);
  assert.equal(h.model.deletions, 1);
  assert.equal(h.model.row, null);
});
test("费用客户丢回执后若改字段/关联账号/修订/时间或形状，不得重新收编", () => {
  for (const patch of [
    { notes: "他人修改" },
    { registered_user_id: "77777777-7777-4777-8777-777777777777" },
    { edit_revision: 2 },
    { unique_name: prefix + "-改名" },
    { unexpected_column: true },
    { updated_at: "2026-11-10T00:01:00Z" },
    { _xmin: "bad" },
  ]) {
    const h = harness({ insertAfterError: true });
    assert.throws(() => h.api.prepareFeeCustomer(h.state));
    Object.assign(h.model.row, patch);
    assert.throws(() => h.api.cleanupFeeCustomer(h.state));
    assert.equal(h.model.deletions, 0);
    assert(h.model.row);
  }
});
test("费用客户确认后修改/消失和准备前碰撞都拒绝", () => {
  const h = harness();
  h.api.prepareFeeCustomer(h.state);
  h.model.row._xmin = "101";
  assert.throws(() => h.api.cleanupFeeCustomer(h.state), /scope_changed/);
  assert.equal(h.model.deletions, 0);
  h.model.row = null;
  assert.throws(
    () => h.api.cleanupFeeCustomer(h.state),
    /missing_since_confirm/,
  );
  const collision = harness();
  collision.model.row = collision.initial();
  assert.throws(
    () => collision.api.prepareFeeCustomer(collision.state),
    /preexisting_id/,
  );
  assert.equal(collision.state.attempted, false);
  assert.equal(collision.model.insertions, 0);
});
test("费用客户0行/错编号/缺回执、仍有记录及删除失败均不能报告成功", () => {
  for (const options of [
    { receipt: { deleted: 0 } },
    { receipt: { deleted: 1, customerId: "other" } },
    { receipt: {} },
    { keepRow: true },
    { keepArchive: true },
    { deleteError: true },
  ]) {
    const h = harness(options);
    h.api.prepareFeeCustomer(h.state);
    assert.throws(() => h.api.cleanupFeeCustomer(h.state));
    assert.equal(h.state.cleaned, undefined);
  }
});

test("费用客户自动档案必须保持唯一初始根，目录改动与文件登记均保留", () => {
  for (const change of [
    (archive) => (archive.folders[0].name = "其他维护改名"),
    (archive) =>
      (archive.archives[0].user_id = "77777777-7777-4777-8777-777777777777"),
    (archive) => archive.files.push({ id: randomUUID() }),
    (archive) => archive.folders.push({ id: randomUUID() }),
  ]) {
    const h = harness();
    h.api.prepareFeeCustomer(h.state);
    change(h.model.archive);
    assert.throws(() => h.api.cleanupFeeCustomer(h.state), /archive_changed/);
    assert.equal(h.model.deletions, 0);
  }
});
test("费用客户已确认回收后重新出现，重复收尾明确拒绝", () => {
  const h = harness();
  h.api.prepareFeeCustomer(h.state);
  h.api.cleanupFeeCustomer(h.state);
  h.model.row = h.initial();
  assert.throws(() => h.api.cleanupFeeCustomer(h.state), /reappeared/);
  assert.equal(h.model.deletions, 1);
});

test("费用历史客户独立编号与受限事务准备，丢回执仍精确回收", () => {
  const h = harness({ historical: true, insertAfterError: true });
  assert.equal(h.state.cohort, "existing");
  assert.throws(() => h.api.prepareFeeCustomer(h.state), /insert-after/);
  const statement = h.model.queries.find((sql) =>
    sql.includes("insert into public.wholesale_customers"),
  );
  assert(statement.startsWith("begin;"));
  assert(
    statement.includes(
      "disable trigger wholesale_customers_10_commission_cohort",
    ),
  );
  assert(
    statement.includes(
      "enable trigger wholesale_customers_10_commission_cohort;commit;",
    ),
  );
  assert.equal(h.api.cleanupFeeCustomer(h.state).deleted, 1);
  assert.equal(h.api.cleanupFeeCustomer(h.state).deleted, 0);
});
