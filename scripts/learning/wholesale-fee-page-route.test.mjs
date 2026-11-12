import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createFeeModel } from "../../tests/test-support/wholesale-fee-model.mjs";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";
function api() {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      fs.readFileSync(
        new URL(
          "../../tests/e2e/helpers/wholesale-fee-page-route.ts",
          import.meta.url,
        ),
        "utf8",
      ),
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.CommonJS,
        },
      },
    ).outputText,
    {
      exports,
      require: (name) => {
        throw Error("unexpected_route_dependency:" + name);
      },
    },
    { timeout: 2000 },
  );
  return exports;
}
const request = (value) => ({ request: () => ({ postDataJSON: () => value }) });

test("费用页面原payload先登记，原请求转发及原响应交付后解除待决", async () => {
  const h = createFeeModel(),
    route = api(),
    events = [],
    payload = { p_notes: "original" },
    response = { ok: () => true };
  await route.forwardFeeWrite(
    {
      ...request(payload),
      fetch: async (options) => {
        // 被测模块在独立 VM 中运行；逐项核对边界值，避免把不同原型误判为请求变化。
        assert.equal(options.timeout, 30000);
        assert.equal(options.maxRetries, 0);
        assert.deepEqual(Object.keys(options).sort(), [
          "maxRetries",
          "timeout",
        ]);
        events.push("fetch");
        return response;
      },
      fulfill: async (options) => {
        assert.equal(options.response, response);
        assert.equal(h.state.dispatchPending, 0);
        events.push("fulfill");
      },
    },
    h.state,
    (value) => {
      assert.equal(value, payload);
      events.push("register");
    },
  );
  assert.deepEqual(events, ["register", "fetch", "fulfill"]);
  assert.equal(h.state.dispatchPending, 0);
});
test("费用页面转发超时保持待决，cleanup不得用零行结果冒充完成", async () => {
  const h = createFeeModel(),
    route = api();
  await assert.rejects(
    route.forwardFeeWrite(
      {
        ...request({}),
        fetch: async () => {
          throw Error("network-timeout");
        },
      },
      h.state,
      () => {},
    ),
    /network-timeout/,
  );
  assert.equal(h.state.dispatchPending, 1);
  assert.throws(
    () => h.modules.orders.cleanupFeeOrder(h.state),
    /dispatch_unconfirmed/,
  );
  assert.equal(h.model.deletions, 0);
});
test("费用页面错误响应仍交付原错误，但保留未确认写入清单", async () => {
  const h = createFeeModel(),
    route = api(),
    response = { ok: () => false };
  let forwarded;
  await route.forwardFeeWrite(
    {
      ...request({}),
      fetch: async () => response,
      fulfill: async (value) => {
        forwarded = value.response;
      },
    },
    h.state,
    () => {},
  );
  assert.equal(forwarded, response);
  assert.equal(h.state.dispatchPending, 1);
  assert.throws(
    () => h.modules.orders.cleanupFeeOrder(h.state),
    /dispatch_unconfirmed/,
  );
});
test("费用页面正文0、路由错误、终止及收尾错误全部保留", async () => {
  const route = api(),
    events = [];
  let handler;
  const page = {
    route: async (_url, value) => {
      handler = value;
    },
    unrouteAll: async (options) => {
      assert.equal(options.behavior, "wait");
      events.push("unroute");
      throw Error("unroute-failed");
    },
  };
  await assert.rejects(
    route.withFeePageRoute(
      page,
      "endpoint",
      async () => {
        throw Error("handler-failed");
      },
      async () => {
        await handler({
          abort: async () => {
            events.push("abort");
            throw Error("abort-failed");
          },
        });
        throw 0;
      },
    ),
    (error) => error.errors.length === 4 && error.errors.includes(0),
  );
  assert.deepEqual(events, ["abort", "unroute"]);
});
test("费用页面路由等待转发终止再返回正文结果", async () => {
  const h = createFeeModel(),
    route = api(),
    events = [];
  let handler, pending;
  const page = {
    route: async (_url, value) => {
      handler = value;
    },
    unrouteAll: async (options) => {
      assert.equal(options.behavior, "wait");
      events.push("wait");
      await pending;
      events.push("drained");
    },
  };
  const result = await route.withFeePageRoute(
    page,
    "endpoint",
    (r) => route.forwardFeeWrite(r, h.state, () => {}),
    async () => {
      pending = handler({
        ...request({}),
        fetch: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return { ok: () => true };
        },
        fulfill: async () => events.push("delivered"),
        abort: async () => {},
      });
      return "done";
    },
  );
  assert.equal(result, "done");
  assert.deepEqual(events, ["wait", "delivered", "drained"]);
  assert.equal(h.state.dispatchPending, 0);
});
test("费用页面两请求交错时，一次完成不能掩盖另一未确认请求", async () => {
  const h = createFeeModel(),
    route = api();
  let resolve;
  const response = new Promise((done) => (resolve = done));
  const first = route.forwardFeeWrite(
    { ...request({}), fetch: async () => response, fulfill: async () => {} },
    h.state,
    () => {},
  );
  await assert.rejects(
    route.forwardFeeWrite(
      {
        ...request({}),
        fetch: async () => {
          throw Error("second-failed");
        },
      },
      h.state,
      () => {},
    ),
  );
  resolve({ ok: () => true });
  await first;
  assert.equal(h.state.dispatchPending, 1);
  assert.throws(
    () => h.modules.orders.cleanupFeeOrder(h.state),
    /dispatch_unconfirmed/,
  );
});
test("原费用afterEach即使等待失败也关闭页面，保留失败证据", async () => {
  const text = fs.readFileSync(
      new URL(
        "../../tests/e2e/wholesale-customer-commission-fees.spec.ts",
        import.meta.url,
      ),
      "utf8",
    ),
    tree = ts.createSourceFile("fees.ts", text, ts.ScriptTarget.Latest, true);
  let callback;
  const visit = (n) => {
    if (
      ts.isCallExpression(n) &&
      n.expression.getText(tree) === "test.afterEach"
    )
      callback = n.arguments[0].getText(tree);
    ts.forEachChild(n, visit);
  };
  visit(tree);
  assert(callback);
  const fixture = { exports: {} },
    events = [];
  vm.runInNewContext(
    ts.transpileModule("fixture.exports=" + callback, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }).outputText,
    { fixture, cleanupFixtureResources },
    { timeout: 2000 },
  );
  await assert.rejects(
    fixture.exports({
      page: {
        unrouteAll: async () => {
          events.push("wait");
          throw Error("wait-failed");
        },
        close: async () => events.push("close"),
      },
    }),
    (error) => error.errors.length === 1,
  );
  assert.deepEqual(events, ["wait", "close"]);
});

test("原防重复场景正文提前抛出0时仍释放刷新闸门", async () => {
  // 只取原路由正文，不导入原套件或认证；重现会让unrouteAll(wait)永久等候的提前失败。
  const source = fs.readFileSync(
    new URL(
      "../../tests/e2e/wholesale-order-creation-idempotency.spec.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const tree = ts.createSourceFile(
    "dedup.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  let callback;
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(tree) === "withFeePageRoute"
    )
      callback = node.arguments[3];
    ts.forEachChild(node, visit);
  };
  visit(tree);
  assert(callback);
  const fixture = { exports: undefined };
  let released = 0;
  vm.runInNewContext(
    ts.transpileModule("fixture.exports=" + callback.getText(tree), {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
    {
      fixture,
      page: {
        getByRole: () => ({
          click: async () => {
            throw 0;
          },
        }),
      },
      releaseOrderRefresh: () => released++,
    },
    { timeout: 2000 },
  );
  await assert.rejects(fixture.exports(), (error) => error === 0);
  assert.equal(released, 1);
});
