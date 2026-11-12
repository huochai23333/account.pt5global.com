import assert from "node:assert/strict";
import test from "node:test";

import { readLimitedJsonBody, RequestBodyTooLargeError } from "../lib/server-request-body.ts";

test("超限后底层取消失败，路由仍能识别请求体过大", async () => {
  let cancelCalls = 0;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('{"value":"中文"}'));
    },
    cancel() {
      cancelCalls += 1;
      throw new Error("connection lost");
    },
  });
  const request = new Request("http://localhost/test", {
    method: "POST",
    headers: { "content-length": "1" },
    body,
    duplex: "half",
  });

  await assert.rejects(readLimitedJsonBody(request, 10), RequestBodyTooLargeError);
  assert.equal(cancelCalls, 1);
  assert.equal(body.locked, false);
});

test("刚好等于上限的 UTF-8 JSON 可以正常读取", async () => {
  const payload = { value: "中文" };
  const body = new TextEncoder().encode(JSON.stringify(payload));
  const request = new Request("http://localhost/test", { method: "POST", body });

  assert.deepEqual(await readLimitedJsonBody(request, body.byteLength), payload);
});
