import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { cleanupTemplateDocumentFixtures } from "../../tests/test-support/template-document-fixture-cleanup.ts";

const id = "b6380000-0000-4000-8000-000000000001";
/** 内存表按真实归属字段选择，不加载原环境、账号或管理员入口。 */
function fixture(overrides = {}) {
  const rows = {
    company_template_draft_operations: [
      { draft_id: id },
      { draft_id: "foreign" },
    ],
    company_template_document_operations: [
      { receipt: { document_id: id } },
      { receipt: { document_id: "foreign" } },
    ],
    company_template_document_drafts: [{ id }, { id: "foreign" }],
    company_template_documents: [{ id }, { id: "foreign" }],
  };
  const calls = [];
  const admin = {
    from(table) {
      const query = { table, action: "read", field: "", ids: [] };
      const builder = {
        select() {
          return builder;
        },
        delete(options) {
          assert.equal(options.count, "exact");
          query.action = "delete";
          return builder;
        },
        in(field, ids) {
          query.field = field;
          query.ids = [...ids];
          return builder;
        },
        then(resolve, reject) {
          calls.push(structuredClone(query));
          const injected = overrides.reply?.(query, calls.length);
          if (injected) return Promise.resolve(injected).then(resolve, reject);
          const matches = (row) =>
            query.ids.includes(
              query.field === "receipt->>document_id"
                ? row.receipt?.document_id
                : row[query.field],
            );
          const count = rows[table].filter(matches).length;
          if (query.action === "delete")
            rows[table] = rows[table].filter((row) => !matches(row));
          return Promise.resolve({ count, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { admin, calls, rows };
}

test("回收四类专属记录并保留其他运行的正文、草稿和回执", async () => {
  const f = fixture();
  await cleanupTemplateDocumentFixtures(f.admin, [id, id]);
  for (const rows of Object.values(f.rows)) assert.equal(rows.length, 1);
  assert.deepEqual(
    f.calls
      .filter((call) => call.action === "delete")
      .map((call) => call.table),
    Object.keys(f.rows),
  );
  assert.ok(
    f.calls.every((call) => call.ids.length === 1 && call.ids[0] === id),
  );
});

test("空集合和无效编号不会触发数据库访问", async () => {
  const f = fixture();
  await cleanupTemplateDocumentFixtures(f.admin, []);
  await assert.rejects(
    cleanupTemplateDocumentFixtures(f.admin, ["%"]),
    /id_invalid/,
  );
  assert.equal(f.calls.length, 0);
});

test("任一读取错误和缺失计数在写入前失败", async () => {
  for (const result of [{ error: new Error("denied") }, { count: null }]) {
    const f = fixture({ reply: () => result });
    await assert.rejects(
      cleanupTemplateDocumentFixtures(f.admin, [id]),
      /denied|count_missing/,
    );
    assert.equal(f.calls.length, 1);
  }
});

test("删除错误或实际零影响不能冒充清理完成", async () => {
  for (const result of [{ error: new Error("delete-denied") }, { count: 0 }]) {
    const f = fixture({
      reply: (query) => query.action === "delete" && result,
    });
    await assert.rejects(
      cleanupTemplateDocumentFixtures(f.admin, [id]),
      /delete-denied|affected_mismatch/,
    );
  }
});

test("独立读取发现残留或计数未知时失败", async () => {
  for (const count of [1, null]) {
    const f = fixture({ reply: (query, index) => index === 3 && { count } });
    await assert.rejects(
      cleanupTemplateDocumentFixtures(f.admin, [id]),
      /remaining|count_missing/,
    );
  }
});

test("最终检查发现异步新增回执时失败", async () => {
  const f = fixture({ reply: (query, index) => index === 13 && { count: 1 } });
  await assert.rejects(
    cleanupTemplateDocumentFixtures(f.admin, [id]),
    /remaining/,
  );
});

test("超过五十个编号分批，全部批次保持限定条件", async () => {
  const f = fixture();
  const ids = Array.from(
    { length: 51 },
    (_, index) =>
      `b6380000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  );
  await cleanupTemplateDocumentFixtures(f.admin, ids);
  assert.ok(f.calls.every((query) => query.ids.length <= 50));
  assert.ok(
    f.calls.some(
      (query) => query.ids.length === 1 && query.ids[0] === ids.at(-1),
    ),
  );
});

test("实际 Supabase SDK 能从无正文删除响应解析精确影响数", async () => {
  const requests = [];
  const responses = [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  const admin = createClient("http://fixture.invalid", "unit-test-only", {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: async (url, options) => {
        requests.push({
          url: String(url),
          method: options.method,
          prefer: new Headers(options.headers).get("prefer"),
        });
        assert.ok(responses.length, "没有允许的额外请求");
        const count = responses.shift();
        return new Response(null, {
          status: options.method === "DELETE" ? 204 : 200,
          headers: { "Content-Range": `*/${count}` },
        });
      },
    },
  });
  await cleanupTemplateDocumentFixtures(admin, [id]);
  assert.equal(responses.length, 0);
  assert.equal(
    requests.filter((request) => request.method === "DELETE").length,
    1,
  );
  assert.ok(
    requests.every((request) => request.prefer?.includes("count=exact")),
  );
  assert.ok(requests.every((request) => request.url.includes(id)));
});
