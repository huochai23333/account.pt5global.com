import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

test("原结汇页面助手等待本笔响应，旧提示和错单响应不能提前放行", async () => {
  const file = "tests/e2e/wholesale-order-settlements.spec.ts";
  const tree = ts.createSourceFile(
    file,
    fs.readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const node = tree.statements.find(
    (n) => ts.isFunctionDeclaration(n) && n.name.text === "recordSettlement",
  );
  const code = ts.transpileModule(node.getText(tree), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  for (const ok of [true, false]) {
    let filter,
      release,
      finished = false,
      clicks = 0;
    const locator = {
      click: async () => {},
      fill: async () => {},
      first: () => locator,
      getByRole: () => locator,
      getByLabel: () => locator,
      getByText: () => locator,
      evaluate: async (fn) =>
        fn({
          click: () => {
            clicks++;
          },
        }),
    };
    const page = {
      getByRole: () => locator,
      waitForResponse: (predicate) => {
        filter = predicate;
        return new Promise((resolve) => {
          release = resolve;
        });
      },
    };
    const expected = (value) => ({
      toBeVisible: async () => {},
      toBe: (answer) => assert.equal(value, answer),
    });
    const record = vm.runInNewContext(
      code + ";recordSettlement",
      { expect: expected, URL, fillDateControl: async () => {} },
      { timeout: 2000 },
    );
    const waiting = record(
      page,
      locator,
      "100",
      "2026-11-10",
      "7.1082",
      "own-order",
    ).then(() => {
      finished = true;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(clicks, 2);
    assert.equal(finished, false);
    assert(filter);
    const response = (
      changed = {},
      method = "POST",
      pathname = "/rest/v1/rpc/add_wholesale_order_settlement",
    ) => ({
      url: () => "http://127.0.0.1:48021" + pathname,
      ok: () => ok,
      request: () => ({
        method: () => method,
        postDataJSON: () => ({
          p_order_id: "own-order",
          p_settlement_amount: 100,
          p_settlement_date: "2026-11-10",
          ...changed,
        }),
      }),
    });
    for (const changed of [
      { p_order_id: "other" },
      { p_settlement_amount: 200 },
      { p_settlement_date: "2026-11-09" },
    ])
      assert.equal(filter(response(changed)), false);
    assert.equal(filter(response({}, "GET")), false);
    assert.equal(filter(response({}, "POST", "/rest/v1/rpc/other")), false);
    assert.equal(filter(response()), true);
    release(response());
    if (ok) {
      await waiting;
      assert.equal(finished, true);
    } else {
      await assert.rejects(waiting);
      assert.equal(finished, false);
    }
  }
});
