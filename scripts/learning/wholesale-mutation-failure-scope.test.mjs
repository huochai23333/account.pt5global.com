import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import { expect } from "@playwright/test";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";

/** 只执行当前失败作用域，Playwright注册及SQL是显式端口，不加载原认证入口。 */
function harness() {
  const state = {
    digest: "before",
    queries: [],
    table: "wholesale_orders",
    fixture: null,
    config: null,
  };
  const base = {
    extend: (definitions) => {
      state.fixture = definitions.wholesaleFailureBoundary[0];
      return {
        use: (config) => {
          state.config = config;
        },
      };
    },
  };
  const reader = (query) => {
    state.queries.push(query);
    return query.includes("pg_class")
      ? [{ name: state.table }]
      : [{ name: state.table, digest: state.digest }];
  };
  const exports = {},
    source = fs.readFileSync(
      "tests/e2e/helpers/wholesale-mutation-failure-scope.ts",
      "utf8",
    );
  const require = (name) => {
    if (name === "node:assert/strict") return assert;
    if (name === "@playwright/test") return { test: base, expect };
    if (name === "../../test-support/fixture-cleanup-sequence")
      return { cleanupFixtureResources };
    if (name === "./local-postgres-query")
      return { readLocalPostgresRows: reader };
    throw Error(`禁止加载未声明依赖：${name}`);
  };
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        esModuleInterop: true,
      },
    }).outputText,
    {
      exports,
      require,
      URL,
      process: { env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:48021" } },
    },
    { timeout: 5000 },
  );
  return { api: exports, state };
}
function route(path, method = "POST", options = {}) {
  const events = [],
    scope = {
      request: () => ({
        url: () => `http://127.0.0.1:48021${path}`,
        method: () => method,
      }),
      abort: async () => {
        events.push("abort");
        if (options.abortError) throw options.abortError;
      },
      continue: async () => {
        events.push("forward");
      },
      fulfill: async (receipt) => {
        if (options.wait) await options.wait;
        if (options.fail) throw options.error;
        events.push(JSON.parse(JSON.stringify(receipt)));
      },
    };
  return { route: scope, events };
}
const endpoints = [
  ["create-order", "/rest/v1/rpc/create_wholesale_order"],
  ["edit-order", "/rest/v1/rpc/update_wholesale_order"],
  ["settlement", "/rest/v1/rpc/add_wholesale_order_settlement"],
  [
    "upload-list",
    "/storage/v1/object/wholesale-order-lists/order/actor/file.csv",
  ],
  ["alias", "/rest/v1/rpc/append_wholesale_customer_other_names"],
  ["link-account", "/rest/v1/rpc/link_wholesale_customer_registered_user"],
  ["assignment", "/rest/v1/rpc/change_wholesale_logistics_store_assignment"],
  ["referral", "/rest/v1/wholesale_referrals?select=id"],
  ["release", "/rest/v1/rpc/create_wholesale_settlement_release"],
];

test("原九种失败写入仅回400且完整消费，不发送真实请求", async () => {
  const { api, state } = harness(),
    scope = api.createFailureBoundary("http://127.0.0.1:48021");
  for (const [operation, path] of endpoints) {
    scope.declare(operation);
    const probe = route(path);
    await scope.handle(probe.route);
    await scope.consume();
    assert.equal(probe.events.length, 1);
    assert.equal(probe.events[0].status, 400);
    assert.equal(
      JSON.parse(probe.events[0].body).message,
      "e2e_forced_failure",
    );
  }
  scope.verify();
  assert.equal(state.config.serviceWorkers, "block");
});

test("旧别名PATCH、错方法、未知GET函数、外部写入和Next写入均拦截", async () => {
  for (const [url, method] of [
    ["/rest/v1/wholesale_customers?id=eq.known", "PATCH"],
    ["/rest/v1/rpc/create_wholesale_order", "PATCH"],
    ["/rest/v1/rpc/unknown_side_effect", "GET"],
    ["/api/mail/send", "POST"],
  ]) {
    const { api } = harness(),
      scope = api.createFailureBoundary("http://127.0.0.1:48021");
    scope.declare("create-order");
    const probe = route(url, method);
    await scope.handle(probe.route);
    assert.deepEqual(probe.events, ["abort"]);
    assert.throws(() => scope.verify());
  }
  const { api } = harness(),
    scope = api.createFailureBoundary("http://127.0.0.1:48021");
  scope.declare("create-order");
  const foreign = route("/rest/v1/rpc/create_wholesale_order");
  foreign.route.request = () => ({
    url: () => "https://foreign.invalid/rest/v1/rpc/create_wholesale_order",
    method: () => "POST",
  });
  await scope.handle(foreign.route);
  assert.deepEqual(foreign.events, ["abort"]);
  assert.throws(
    () => api.createFailureBoundary("https://cloud.invalid"),
    /requires_local_api/,
  );
});

test("读取白名单明确，不按get前缀猜只读；原Auth只允许必要本地端点", async () => {
  const { api } = harness(),
    scope = api.createFailureBoundary("http://127.0.0.1:48021");
  for (const [url, method] of [
    ["/rest/v1/wholesale_orders?select=id", "GET"],
    ["/rest/v1/rpc/get_wholesale_order_page", "POST"],
    ["/rest/v1/rpc/list_wholesale_customer_link_candidates", "POST"],
    ["/auth/v1/token?grant_type=password", "POST"],
    ["/auth/v1/token?grant_type=refresh_token", "POST"],
    ["/auth/v1/logout", "POST"],
    ["/auth/v1/user", "GET"],
    ["/auth/v1/token?grant_type=password", "OPTIONS"],
    ["/rest/v1/rpc/create_wholesale_order", "OPTIONS"],
  ]) {
    const probe = route(url, method);
    await scope.handle(probe.route);
    assert.deepEqual(probe.events, ["forward"]);
  }
  for (const url of [
    "/rest/v1/rpc/get_unknown_write",
    "/auth/v1/signup",
    "/auth/v1/token?grant_type=client_credentials",
  ]) {
    const probe = route(url);
    await scope.handle(probe.route);
    assert.deepEqual(probe.events, ["abort"]);
  }
});

test("回包尚未完成的并发重复也拒绝，遗漏消费或未命中不能通过", async () => {
  const { api } = harness(),
    scope = api.createFailureBoundary("http://127.0.0.1:48021");
  scope.declare("create-order");
  let release;
  const waiting = new Promise((resolve) => {
    release = resolve;
  });
  const first = route(endpoints[0][1], "POST", { wait: waiting }),
    pending = scope.handle(first.route);
  const second = route(endpoints[0][1]);
  await scope.handle(second.route);
  assert.deepEqual(second.events, ["abort"]);
  release();
  await pending;
  await scope.consume();
  assert.throws(() => scope.verify(), /not_verified/);
  const empty = api.createFailureBoundary("http://127.0.0.1:48021");
  empty.declare("release");
  assert.throws(() => empty.verify(), /not_verified/);
  assert.throws(() => empty.declare("release"), /repeated/);
  assert.throws(() => empty.declare("unknown"), /unknown/);
});

test("失败回包和abort同时失败，抛出0也保留，不能记为已命中", async () => {
  const { api } = harness(),
    scope = api.createFailureBoundary("http://127.0.0.1:48021");
  scope.declare("create-order");
  const probe = route(endpoints[0][1], "POST", {
    fail: true,
    error: 0,
    abortError: Error("abort-failed"),
  });
  await scope.handle(probe.route);
  let failure;
  try {
    scope.verify();
  } catch (error) {
    failure = error;
  }
  assert(failure);
  assert.equal(failure.errors[0], 0);
  assert.equal(failure.errors[1].message, "abort-failed");
  assert.equal(failure.errors.length, 3);
  assert.deepEqual(probe.events, ["abort"]);
});

test("摘要覆盖全部批发表/计数器和对象version，异常表名在执行查询前拒绝", () => {
  const { api, state } = harness();
  api.readWholesaleFailureProof();
  assert.equal(state.queries.length, 2);
  assert.match(state.queries[0], /order_number_counter/);
  assert.match(state.queries[1], /_xmin/);
  assert.match(state.queries[1], /storage\.objects/);
  assert.match(state.queries[1], /-'last_accessed_at'-'updated_at'/);
  state.table = "wholesale_orders;delete from auth.users";
  assert.throws(() => api.readWholesaleFailureProof(), /tables_missing/);
  assert.equal(state.queries.length, 3);
});

test("自动作用域完成消费后排空再核对，清掉绑定；之后不能追加写入", async () => {
  const { api, state } = harness(),
    events = [];
  let handler;
  const page = {
    route: async (_url, callback) => {
      handler = callback;
      events.push("installed");
    },
    unrouteAll: async (options) => {
      assert.equal(options.behavior, "wait");
      events.push("drained");
    },
  };
  await state.fixture({ page }, async () => {
    events.push("body");
    await api.failJsonRequest(page, "create-order");
    const probe = route(endpoints[0][1]);
    await handler(probe.route);
    await api.expectInterceptedFailure(page);
  });
  assert.deepEqual(events, ["installed", "body", "drained"]);
  assert.equal(state.queries.length, 4);
  await assert.rejects(
    api.failJsonRequest(page, "create-order"),
    /not_installed/,
  );
});

test("正文0、排空失败和摘要变化三项错误全保留，仍解除页面绑定", async () => {
  const { api, state } = harness();
  let handler;
  const page = {
    route: async (_url, callback) => {
      handler = callback;
    },
    unrouteAll: async () => {
      throw Error("drain-failed");
    },
  };
  let failure;
  try {
    await state.fixture({ page }, async () => {
      await api.failJsonRequest(page, "create-order");
      await handler(route(endpoints[0][1]).route);
      await api.expectInterceptedFailure(page);
      state.digest = "changed";
      throw 0;
    });
  } catch (error) {
    failure = error;
  }
  assert(failure);
  assert.equal(failure.errors.length, 3);
  assert.equal(failure.errors[0], 0);
  assert.equal(failure.errors[1].message, "drain-failed");
  assert.match(failure.errors[2].message, /business_data_changed/);
  await assert.rejects(
    api.failJsonRequest(page, "create-order"),
    /not_installed/,
  );
});

test("安装路由失败不运行正文，仍核对数据和解除绑定", async () => {
  const { api, state } = harness();
  let ran = false,
    drained = false;
  const page = {
    route: async () => {
      throw Error("install-failed");
    },
    unrouteAll: async () => {
      drained = true;
    },
  };
  let failure;
  try {
    await state.fixture({ page }, async () => {
      ran = true;
    });
  } catch (error) {
    failure = error;
  }
  assert.equal(ran, false);
  assert.equal(drained, true);
  assert.equal(failure.errors[0].message, "install-failed");
  assert.equal(state.queries.length, 4);
  await assert.rejects(
    api.failJsonRequest(page, "create-order"),
    /not_installed/,
  );
});
