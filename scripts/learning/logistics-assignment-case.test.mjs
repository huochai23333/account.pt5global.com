import assert from "node:assert/strict";
import test from "node:test";
import { createLogisticsAssignmentCase } from "../../tests/test-support/logistics-assignment-case.ts";
import { isolateSourceRefresh } from "../../tests/e2e/helpers/logistics-page-assertions.ts";

const peer = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  admin = "11111111-1111-4111-8111-111111111111";
function harness() {
  const responses = [],
    calls = [];
  const fixture = createLogisticsAssignmentCase((statement) => {
    calls.push(statement);
    assert(responses.length, "unexpected SQL");
    const r = responses.shift();
    if (r instanceof Error) throw r;
    return JSON.stringify(typeof r === "function" ? r(fixture) : r);
  });
  return { fixture, responses, calls };
}
function initial(f) {
  const shared = {
    store_name: f.storeName,
    store_name_normalized: f.storeName.toLowerCase(),
    _xmin: "100",
  };
  return {
    assignments: [
      {
        ...shared,
        id: f.assignmentId,
        sales_user_id: "55555555-5555-4555-8555-555555555555",
        customer_id: "c1000000-0000-4000-8000-000000000002",
        effective_from: null,
        effective_to: null,
        created_by_user_id: admin,
        updated_by_user_id: admin,
        updated_at: "2026-11-11T00:00:00Z",
      },
    ],
    records: [
      {
        ...shared,
        id: f.recordId,
        source_system: "dianxiaomi",
        source_order_id: 1,
        package_number: f.packageNumber,
        shipping_cost: 1,
        shipping_currency: "CNY",
      },
    ],
  };
}
function changed(f) {
  const p = initial(f);
  Object.assign(p.assignments[0], {
    sales_user_id: peer,
    customer_id: "c1000000-0000-4000-8000-000000000001",
    updated_at: "2026-11-11T00:01:00Z",
    _xmin: "101",
  });
  return p;
}
function prepared() {
  const h = harness();
  h.responses.push([peer], initial, initial);
  h.fixture.prepare();
  return h;
}

// 本组只验证显式响应边界；正式归属函数/RLS/触发器和锁内CAS另在专属PG执行。
test("未准备回收与非法目标不触发SQL", () => {
  const h = harness();
  assert.deepEqual(h.fixture.cleanup(), { assignments: 0, records: 0 });
  assert.throws(() => h.fixture.confirm("other"), /target_invalid/);
  assert.equal(h.calls.length, 0);
});
test("同行业务员缺失、重复或编号异常均不能创建夹具", () => {
  for (const rows of [[], [peer, peer], ["invalid"]]) {
    const h = harness();
    h.responses.push(rows);
    assert.throws(() => h.fixture.prepare(), /peer_ambiguous/);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.fixture.cleanup(), { assignments: 0, records: 0 });
  }
});
test("准备只用本次UUID店铺/包裹且两表同事务、独立读回", () => {
  const h = prepared();
  assert.equal(h.calls.length, 3);
  assert.match(h.calls[1], /^begin;/);
  assert.match(h.calls[1], /insert into public.wholesale_logistics_records/);
  assert.match(
    h.calls[1],
    /insert into public.wholesale_logistics_store_assignments/,
  );
  assert.match(h.calls[1], /commit;$/);
  assert(!h.calls.join("").includes("Local Shop Alpha"));
});
test("准备提交回包丢失不能猜测删除，也不能重复插入", () => {
  const h = harness();
  h.responses.push([peer], new Error("lost after commit"));
  assert.throws(() => h.fixture.prepare(), /lost after commit/);
  assert.throws(() => h.fixture.cleanup(), /prepare_outcome_unknown/);
  assert.throws(() => h.fixture.prepare(), /already_attempted/);
  assert.equal(h.calls.length, 2);
});
test("错误归属、额外区间和包裹归属异常不能接受初始凭证", () => {
  for (const change of [
    (p) => (p.assignments[0].customer_id = "foreign"),
    (p) => p.assignments.push(p.assignments[0]),
    (p) => (p.records[0].store_name = "foreign"),
    (p) => (p.records[0].shipping_cost = "NaN"),
  ]) {
    const h = harness();
    h.responses.push([peer], (f) => {
      const p = initial(f);
      change(p);
      return p;
    });
    assert.throws(
      () => h.fixture.prepare(),
      /initial_owner_invalid|scope_count|receipt_invalid/,
    );
    assert.throws(() => h.fixture.cleanup(), /prepare_outcome_unknown/);
  }
});
test("同值新版本和0行未改变时均不能当成成功调整", () => {
  const h = prepared();
  h.responses.push(initial);
  assert.throws(() => h.fixture.confirm("peer"), /transition_invalid/);
  h.responses.push((f) => {
    const p = initial(f);
    p.records[0]._xmin = "101";
    return p;
  });
  assert.throws(() => h.fixture.unchanged(), /case_changed/);
});
test("调整时改审计人、陌生字段或包裹内容均拒绝，不推进清理基准", () => {
  const h = prepared();
  for (const change of [
    (p) => (p.assignments[0].updated_by_user_id = peer),
    (p) => (p.assignments[0].extra = true),
    (p) => (p.records[0].shipping_cost = 2),
  ]) {
    h.responses.push((f) => {
      const p = changed(f);
      change(p);
      return p;
    });
    assert.throws(
      () => h.fixture.confirm("peer"),
      /transition_invalid|unexpected_write|receipt_invalid/,
    );
  }
  assert.deepEqual(h.fixture.snapshot(), initial(h.fixture));
});
test("确认和恢复都要求新版本，返回凭证与证据副本不能改写内部快照", () => {
  const h = prepared();
  h.responses.push(changed);
  const receipt = h.fixture.confirm("peer");
  receipt.store_name = "foreign";
  h.fixture.evidence().expected.records[0].shipping_cost = 2;
  h.fixture.snapshot().assignments[0].sales_user_id = "foreign";
  h.responses.push(changed);
  h.fixture.unchanged();
  h.responses.push((f) => {
    const p = initial(f);
    p.assignments[0]._xmin = "102";
    return p;
  });
  h.fixture.confirm("initial");
  assert.equal(h.fixture.snapshot().assignments[0]._xmin, "102");
});
test("两表各实际删除1行后新连接查零才确认回收", () => {
  const h = prepared();
  h.responses.push((f) => ({ assignments: 1, records: 1, owner: f.owner }), {
    assignments: [],
    records: [],
  });
  assert.equal(h.fixture.cleanup().records, 1);
  assert(h.fixture.evidence().cleaned);
  assert.deepEqual(h.fixture.cleanup(), { assignments: 0, records: 0 });
});
test("零影响、丢响应或剩余记录不能算清理成功，也不能盲目重试", () => {
  for (const responses of [
    [{ assignments: 0, records: 1 }],
    [new Error("lost after commit")],
    [
      (f) => ({ assignments: 1, records: 1, owner: f.owner }),
      { assignments: [], records: [{ id: "held" }] },
    ],
  ]) {
    const h = prepared();
    h.responses.push(...responses);
    assert.throws(
      () => h.fixture.cleanup(),
      /receipt_invalid|lost after commit|not_final/,
    );
    assert.throws(() => h.fixture.cleanup(), /cleanup_outcome_unknown/);
    assert.equal(h.fixture.evidence().cleaned, false);
  }
});
test("同步隔离安装在上下文层并覆盖查询参数及末尾斜杠", async () => {
  let matcher;
  await isolateSourceRefresh({
    context: () => ({
      route: async (match) => {
        matcher = match;
      },
    }),
  });
  for (const url of [
    "http://localhost:48021/functions/v1/wholesale-logistics-sync",
    "https://example.invalid/functions/v1/wholesale-logistics-sync/?refresh=1",
  ])
    assert.equal(matcher(new URL(url)), true);
  assert.equal(
    matcher(
      new URL("http://localhost/functions/v1/wholesale-logistics-sync-other"),
    ),
    false,
  );
});
test("隔离边界不转发同步请求，OPTIONS正常而实际刷新明确503", async () => {
  let handler;
  await isolateSourceRefresh({
    context: () => ({
      route: async (_, handle) => {
        handler = handle;
      },
    }),
  });
  for (const [method, expected] of [
    ["OPTIONS", 200],
    ["POST", 503],
    ["GET", 503],
  ]) {
    let response;
    await handler({
      request: () => ({ method: () => method }),
      fulfill: async (r) => {
        response = r;
      },
      continue: () => {
        throw Error("must not reach supplier");
      },
    });
    assert.equal(response.status, expected);
    assert.equal(response.json.error, "local_read_regression");
  }
});
