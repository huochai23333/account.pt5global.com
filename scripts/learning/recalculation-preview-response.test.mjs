import assert from "node:assert/strict";
import test from "node:test";
import { requestRecalculationPreview } from "../../tests/e2e/helpers/recalculation-preview-response.ts";

const id = "a1000000-0000-4000-8000-000000000001";
const response = (value = id, ok = true) => ({
  ok: () => ok,
  json: async () => value,
});
test("等待先于点击，只接受精确RPC路径和POST的本次回包编号", async () => {
  const calls = [];
  const page = {
    waitForResponse(predicate, options) {
      calls.push("wait");
      assert.equal(options.timeout, 60_000);
      const candidate = (path, method) => ({
        url: () => "http://127.0.0.1:48051" + path,
        request: () => ({ method: () => method }),
      });
      assert.equal(predicate(candidate("/rest/v1/rpc/other", "POST")), false);
      assert.equal(
        predicate(
          candidate(
            "/rest/v1/rpc/preview_exchange_rate_recalculation_extra",
            "POST",
          ),
        ),
        false,
      );
      assert.equal(
        predicate(
          candidate("/rest/v1/rpc/preview_exchange_rate_recalculation", "GET"),
        ),
        false,
      );
      assert.equal(
        predicate(
          candidate(
            "/rest/v1/rpc/preview_exchange_rate_recalculation/?probe=1",
            "POST",
          ),
        ),
        true,
      );
      return Promise.resolve(response());
    },
  };
  assert.equal(
    await requestRecalculationPreview(page, async () => calls.push("click")),
    id,
  );
  assert.deepEqual(calls, ["wait", "click"]);
});
test("HTTP失败不解析正文；空/数组/对象/非UUID不回退最新记录", async () => {
  await assert.rejects(
    requestRecalculationPreview(
      {
        waitForResponse: () =>
          Promise.resolve({
            ok: () => false,
            json: () => {
              throw Error("must not parse");
            },
          }),
      },
      async () => {},
    ),
    /response_failed/,
  );
  for (const value of [null, "", [], { id }, "not-uuid"])
    await assert.rejects(
      requestRecalculationPreview(
        { waitForResponse: () => Promise.resolve(response(value)) },
        async () => {},
      ),
      /id_invalid/,
    );
});
test("点击、响应等待或JSON失败保持原错误", async () => {
  const failure = Error("original");
  for (const [page, click] of [
    [
      { waitForResponse: () => Promise.resolve(response()) },
      async () => {
        throw failure;
      },
    ],
    [{ waitForResponse: () => Promise.reject(failure) }, async () => {}],
    [
      {
        waitForResponse: () =>
          Promise.resolve({
            ok: () => true,
            json: async () => {
              throw failure;
            },
          }),
      },
      async () => {},
    ],
  ])
    await assert.rejects(
      requestRecalculationPreview(page, click),
      (e) => e === failure,
    );
});
