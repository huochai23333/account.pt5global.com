import assert from "node:assert/strict";
import test from "node:test";

import { runVerifiedActionWithRefresh } from "../lib/verified-action-outcome.ts";

test("写入和刷新都完成时返回 succeeded", async () => {
  const calls = [];
  const outcome = await runVerifiedActionWithRefresh(
    async () => calls.push("write"),
    async () => calls.push("refresh"),
  );

  assert.equal(outcome, "succeeded");
  assert.deepEqual(calls, ["write", "refresh"]);
});

test("写入已完成但刷新失败时返回 refreshing", async () => {
  const outcome = await runVerifiedActionWithRefresh(
    async () => undefined,
    async () => {
      throw new Error("refresh_failed");
    },
  );

  assert.equal(outcome, "refreshing");
});

test("写入失败仍然抛错且不会执行刷新", async () => {
  let refreshed = false;

  await assert.rejects(
    runVerifiedActionWithRefresh(
      async () => {
        throw new Error("write_failed");
      },
      async () => {
        refreshed = true;
      },
    ),
    /write_failed/,
  );
  assert.equal(refreshed, false);
});
