import assert from "node:assert/strict";
import test from "node:test";
import {
  records,
  reset,
  mailFixtureStore,
  jsonResponse,
} from "../../tests/test-support/mail-fixture-store.mjs";

test("插入使用真实 SDK 请求，并独立查回同一组目标编号", async () => {
  const { client, calls } = mailFixtureStore();
  await records.insertMailFixtureRecords(client, "mail_threads", [
    { id: "b" },
    { id: "a" },
  ]);
  assert.deepEqual(
    calls.map((call) => call.method),
    ["POST", "GET"],
  );
  assert.equal(calls[0].query.get("select"), "id");
  assert.equal(calls[1].query.get("id"), "in.(a,b)");
});

test("空集合不写入；缺少或重复目标编号在发请求前拒绝", async () => {
  const { client, calls } = mailFixtureStore();
  await records.insertMailFixtureRecords(client, "mail_threads", []);
  for (const rows of [[{}], [{ id: "" }], [{ id: "a" }, { id: "a" }]])
    await assert.rejects(
      records.insertMailFixtureRecords(client, "mail_threads", rows),
      /唯一凭证/,
    );
  assert.equal(calls.length, 0);
});

test("写入成功回包为空、编号错误或非记录均不得进入独立核对", async () => {
  for (const response of [
    [],
    [{ id: "wrong" }],
    [null],
    [{ id: "a" }, { id: "a" }],
  ]) {
    const { client, calls } = mailFixtureStore({
      override: () => jsonResponse(response, 201),
    });
    await assert.rejects(
      records.insertMailFixtureRecords(client, "mail_threads", { id: "a" }),
    );
    assert.equal(calls.length, 1);
  }
});

test("写入回包正确但独立读取丢失或多出重复记录时拒绝", async () => {
  for (const result of [[], [{ id: "a" }, { id: "a" }], [{ id: "another" }]]) {
    const { client } = mailFixtureStore({
      override: (call) =>
        call.method === "GET" ? jsonResponse(result) : undefined,
    });
    await assert.rejects(
      records.insertMailFixtureRecords(client, "mail_threads", { id: "a" }),
    );
  }
});

test("写入与独立读取的数据库错误保留 cause，不当作无记录成功", async () => {
  for (const method of ["POST", "GET"]) {
    const { client } = mailFixtureStore({
      override: (call) =>
        call.method === method
          ? jsonResponse({ code: "42501", message: "synthetic-denied" }, 403)
          : undefined,
    });
    await assert.rejects(
      records.insertMailFixtureRecords(client, "mail_threads", { id: "a" }),
      (error) => error.cause?.code === "42501",
    );
  }
});

test("清理有精确影响数且独立为空；原本为空也须实际核对", async () => {
  for (const initial of [[], [{ id: "a" }, { id: "b" }]]) {
    const { client, calls } = mailFixtureStore({
      initial: { mail_threads: initial },
    });
    assert.equal(
      await records.clearMailFixtureTable(client, "mail_threads", "id"),
      initial.length,
    );
    assert.deepEqual(
      calls.map((call) => call.method),
      ["DELETE", "HEAD"],
    );
    assert.equal(calls[0].query.get("id"), "not.is.null");
    assert(calls[0].headers.get("prefer").includes("count=exact"));
  }
});

test("清理缺少影响数、读取缺少总数或有残留一律拒绝", async () => {
  const cases = [
    (call) =>
      call.method === "DELETE"
        ? new Response(null, { status: 204 })
        : undefined,
    (call) =>
      call.method === "HEAD" ? new Response(null, { status: 200 }) : undefined,
    (call) =>
      call.method === "HEAD"
        ? new Response(null, {
            status: 200,
            headers: { "content-range": "*/1" },
          })
        : undefined,
  ];
  for (const override of cases) {
    const { client } = mailFixtureStore({ override });
    await assert.rejects(
      records.clearMailFixtureTable(client, "mail_threads", "id"),
    );
  }
});

test("清理或核对失败停止后续表，保留失败原因", async () => {
  for (const method of ["DELETE", "HEAD"]) {
    const { client, calls } = mailFixtureStore({
      override: (call) =>
        call.method === method
          ? jsonResponse({ code: "42501", message: "synthetic-denied" }, 403)
          : undefined,
    });
    await assert.rejects(
      reset.clearIntegratedMailFixture(client),
      (error) => error.cause?.code === "42501",
    );
    assert(
      calls.every((call) => call.table === "mail_inbound_ignore_receipts"),
    );
  }
});
