import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { countTemplates, countVersions, deleteTemplate, deleteTemplateDocument, deleteTemplateFixture, readTemplateBySlug, readVersion, } from "../../tests/e2e/helpers/company-template-records.ts";
const id = "b6370000-0000-4000-8000-000000000001";
const templateId = "b6370000-0000-4000-8000-000000000002";
/** 明确提供每一步 SDK 响应；任何多余访问失败，不加载原认证或环境模块。 */
function client(replies) {
  const calls = [];
  const admin = {
    from(table) {
      const steps = [["from", table]];
      const query = {};
      for (const name of [
        "select",
        "eq",
        "update",
        "delete",
        "single",
        "maybeSingle",
      ]) {
        query[name] = (...args) => {
          steps.push([name, ...args]);
          return query;
        };
      }
      query.then = (resolve, reject) => {
        calls.push(steps);
        if (!replies.length)
          return Promise.reject(new Error("unexpected_query")).then(resolve, reject);
        return Promise.resolve(replies.shift()).then(resolve, reject);
      };
      return query;
    },
  };
  return { admin, calls };
}
test("缺失计数不能伪装成零行", async () => {
  for (const count of [null, undefined, -1, 0.5, NaN]) {
    for (const read of [countTemplates, countVersions]) {
      await assert.rejects(read(client([{ count }]).admin, id), /count_missing/);
    }
  }
});
test("两个计数分别限定模板主键和版本外键，明确的零行可以读取", async () => {
  const f = client([{ count: 0 }, { count: 2 }]);
  assert.equal(await countTemplates(f.admin, id), 0);
  assert.equal(await countVersions(f.admin, id), 2);
  assert.deepEqual(f.calls.map((call) => [call[0], call.at(-1)]), [
    [
      ["from", "company_templates"],
      ["eq", "id", id],
    ],
    [
      ["from", "company_template_versions"],
      ["eq", "template_id", id],
    ],
  ]);
});
test("删除必须核对清空版本指针、实际影响编号和两个集合的零行", async () => {
  const f = client([
    { data: { id } },
    { data: [{ id }] },
    { data: [{ id }] },
    { count: 0 },
    { count: 0 },
  ]);
  await deleteTemplate(f.admin, id);
  assert.equal(f.calls.length, 5);
  assert.deepEqual(f.calls[1][1], ["update", { current_version_id: null }]);
  assert.deepEqual(f.calls[2][1], ["delete"]);
  assert.ok(f.calls
    .slice(3)
    .every((steps) => steps.some(([name, , options]) => name === "select" &&
    options?.head === true &&
    options.count === "exact")));
});
test("创建前失败的空夹具也要核对主表和版本均为空，不执行空删除", async () => {
  const f = client([{ data: null }, { count: 0 }, { count: 0 }]);
  await deleteTemplate(f.admin, id);
  assert.equal(f.calls.length, 3);
  assert.ok(!f.calls.flat().some(([name]) => ["delete", "update"].includes(name)));
});
test("空夹具仍有版本时失败", async () => {
  await assert.rejects(deleteTemplate(client([{ data: null }, { count: 0 }, { count: 1 }]).admin, id), /cleanup_failed/);
});
test("无效编号在首次访问前拒绝", async () => {
  const f = client([]);
  await assert.rejects(deleteTemplate(f.admin, ""), /id_invalid/);
  await assert.rejects(deleteTemplate(f.admin, "all%"), /id_invalid/);
  assert.equal(f.calls.length, 0);
});
test("已存在夹具的零影响或错编号不能继续删除", async () => {
  for (const data of [[], null, [{ id: "other" }], [{ id }, { id }]]) {
    const f = client([{ data: { id } }, { data }]);
    await assert.rejects(deleteTemplate(f.admin, id), /affected_mismatch/);
    assert.equal(f.calls.length, 2);
  }
  await assert.rejects(deleteTemplate(client([{ data: { id } }, { data: [{ id }] }, { data: [] }]).admin, id), /affected_mismatch/);
});
test("残留主表、残留版本和未拿到计数均失败", async () => {
  for (const counts of [
    [1, 0],
    [0, 1],
    [null, 0],
    [0, null],
  ]) {
    await assert.rejects(deleteTemplate(client([
      { data: { id } },
      { data: [{ id }] },
      { data: [{ id }] },
      ...counts.map((count) => ({ count })),
    ]).admin, id), /cleanup_failed|count_missing/);
  }
});
test("读取、清指针、删除及独立计数的错误保持原样传播", async () => {
  const replies = [
    { data: { id } },
    { data: [{ id }] },
    { data: [{ id }] },
    { count: 0 },
    { count: 0 },
  ];
  for (let index = 0; index < replies.length; index++) {
    const failure = new Error(`step-${index}`);
    const scenario = [...replies.slice(0, index), { error: failure }];
    const f = client(scenario);
    await assert.rejects(deleteTemplate(f.admin, id), (error) => error === failure);
    assert.equal(f.calls.length, index + 1);
  }
});
test("权威记录读取不能返回缺失正文，错误也不变成空值", async () => {
  for (const read of [readTemplateBySlug, readVersion]) {
    await assert.rejects(read(client([{ data: null }]).admin, id), /missing/);
    const failure = new Error("denied");
    await assert.rejects(read(client([{ error: failure }]).admin, id), (error) => error === failure);
  }
});
test("真实SDK删除收到错误并不会自动抛出，调用方必须检查结果", async () => {
  let calls = 0;
  // fetch完全在进程内响应，不连接该地址或加载任何认证辅助；复现原finally忽略error的SDK行为。
  const sdk = createClient("http://127.0.0.1:48021", "fixture-key", { auth: { persistSession: false }, global: { fetch: async () => {
        calls += 1;
        return new Response(JSON.stringify({ code: "23503", message: "fixture foreign key conflict" }), { status: 409, headers: { "Content-Type": "application/json" } });
      } } });
  const result = await sdk.from("company_template_documents").delete().eq("id", id);
  assert.equal(result.error.code, "23503");
  assert.equal(calls, 1);
});
test("文档清理按本次模板限定删除，并独立取得零行", async () => {
  const f = client([{ data: { id, template_id: templateId } }, { data: [{ id }] }, { count: 0 }]);
  assert.deepEqual(await deleteTemplateDocument(f.admin, id, templateId), { documentId: id, remainingDocuments: 0 });
  assert.deepEqual(f.calls[1], [["from", "company_template_documents"], ["delete"], ["eq", "id", id], ["eq", "template_id", templateId], ["select", "id"]]);
  assert.equal(f.calls.length, 3);
});
test("文档本来不存在时只核对零行，不执行空删除", async () => {
  const f = client([{ data: null }, { count: 0 }]);
  await deleteTemplateDocument(f.admin, id, templateId);
  assert.equal(f.calls.length, 2);
  assert(!f.calls.flat().some(([name]) => name === "delete"));
  await assert.rejects(deleteTemplateDocument(client([{ data: null }, { count: 1 }]).admin, id, templateId), /cleanup_failed/);
});
test("错误归属或编号的文档在删除之前拒绝", async () => {
  for (const data of [{ id, template_id: id }, { id: templateId, template_id: templateId }]) {
    const f = client([{ data }]);
    await assert.rejects(deleteTemplateDocument(f.admin, id, templateId), /ownership_mismatch/);
    assert.equal(f.calls.length, 1);
  }
  const f = client([]);
  await assert.rejects(deleteTemplateDocument(f.admin, "all%", templateId), /id_invalid/);
  await assert.rejects(deleteTemplateDocument(f.admin, id, ""), /id_invalid/);
  assert.equal(f.calls.length, 0);
});
test("文档读取后删除零影响或错编号不能冒充完成", async () => {
  for (const data of [[], null, [{ id: templateId }], [{ id }, { id }]]) {
    const f = client([{ data: { id, template_id: templateId } }, { data }]);
    await assert.rejects(deleteTemplateDocument(f.admin, id, templateId), /affected_mismatch/);
    assert.equal(f.calls.length, 2);
  }
});
test("文档删除后残留或缺失计数都失败", async () => {
  for (const count of [1, null, undefined, -1, 0.5]) {
    await assert.rejects(deleteTemplateDocument(client([{ data: { id, template_id: templateId } }, { data: [{ id }] }, { count }]).admin, id, templateId), /cleanup_failed|count_missing/);
  }
});
test("文档读取、删除及最终计数的SDK错误保持传播", async () => {
  const replies = [{ data: { id, template_id: templateId } }, { data: [{ id }] }, { count: 0 }];
  for (let index = 0; index < replies.length; index++) {
    const failure = new Error(`document-step-${index}`);
    const f = client([...replies.slice(0, index), { error: failure }]);
    await assert.rejects(deleteTemplateDocument(f.admin, id, templateId), error => error === failure);
    assert.equal(f.calls.length, index + 1);
  }
});

// 丢失发布响应时尚无模板编号；只允许本次UUID标记恢复，所有访问仍由进程内响应驱动。
const marker = `Template cleanup ${templateId}`;
const fixtureReplies = () => [
  { data: [{ id }] },
  { data: { id, template_id: templateId } }, { data: [{ id }] }, { count: 0 },
  { count: 0 },
  { data: { id: templateId } }, { data: [{ id: templateId }] }, { data: [{ id: templateId }] },
  { count: 0 }, { count: 0 },
];

test("批次清理已知编号时不查询公共名称，逐文档核对后才删父模板", async () => {
  const f = client(fixtureReplies());
  await deleteTemplateFixture(f.admin, { id: templateId });
  assert.equal(f.calls.length, 10);
  assert.deepEqual(f.calls[0].at(-1), ["eq", "template_id", templateId]);
  assert.deepEqual(f.calls[4].at(-1), ["eq", "template_id", templateId]);
  assert.deepEqual(f.calls[7][0], ["from", "company_templates"]);
});

test("编号未读回时以精确UUID标记恢复，缺失标记不发起查询", async () => {
  const f = client([{ data: { id: templateId, name: marker } }, ...fixtureReplies()]);
  await deleteTemplateFixture(f.admin, { name: marker });
  assert.deepEqual(f.calls[0], [["from", "company_templates"], ["select", "id,name"], ["eq", "name", marker], ["maybeSingle"]]);
  for (const fixture of [{}, { name: "Shared template" }, { name: "x".repeat(70) }, { id: "all%", name: marker }]) {
    const untouched = client([]);
    await assert.rejects(deleteTemplateFixture(untouched.admin, fixture), /marker_invalid|id_invalid/);
    assert.equal(untouched.calls.length, 0);
  }
});

test("发布本来未完成时仍核对精确标记为零，不执行删除", async () => {
  const f = client([{ data: null }, { count: 0 }]);
  await deleteTemplateFixture(f.admin, { name: marker });
  assert.equal(f.calls.length, 2);
  assert.deepEqual(f.calls[1].at(-1), ["eq", "name", marker]);
  await assert.rejects(deleteTemplateFixture(client([{ data: null }, { count: 1 }]).admin, { name: marker }), /cleanup_failed/);
  await assert.rejects(deleteTemplateFixture(client([{ data: { id: templateId, name: "Other fixture" } }]).admin, { name: marker }), /ownership_mismatch/);
});

test("列表被截断或出现迟到文档时不能继续删除父模板", async () => {
  const f = client([{ data: [] }, { count: 1 }]);
  await assert.rejects(deleteTemplateFixture(f.admin, { id: templateId }), /cleanup_failed/);
  assert.equal(f.calls.length, 2);
  for (const data of [null, undefined, {}, "not-a-list"]) {
    await assert.rejects(deleteTemplateFixture(client([{ data }]).admin, { id: templateId }), /documents_missing/);
  }
});

test("批次任一步SDK错误都停止后续写入并保留原错误", async () => {
  const replies = [{ data: { id: templateId, name: marker } }, ...fixtureReplies()];
  for (let index = 0; index < replies.length; index++) {
    const failure = new Error(`fixture-step-${index}`);
    const f = client([...replies.slice(0, index), { error: failure }]);
    await assert.rejects(deleteTemplateFixture(f.admin, { name: marker }), error => error === failure);
    assert.equal(f.calls.length, index + 1);
  }
});
