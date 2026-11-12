import assert from "node:assert/strict";
import test from "node:test";
import { createTemplateDraftInsertFault } from "../../tests/test-support/template-draft-insert-fault.ts";
import { cleanupTemplateDraftRecords } from "../../tests/test-support/template-draft-cleanup.ts";

const id = "b1000000-0000-4000-8000-000000000001",
  owner = "55555555-5555-4555-8555-555555555555";
const tables = [
  "company_template_draft_operations",
  "company_template_document_operations",
  "company_template_document_drafts",
  "company_template_documents",
];
const empty = () => Object.fromEntries(tables.map((name) => [name, []]));
function snapshot(actor = owner) {
  const value = empty();
  value.company_template_document_drafts = [
    { record: { id, owner_id: actor, state: { client: "O'Brien $$ <script>" } }, version: "123" },
  ];
  return value;
}
function installed(sql) {
  const name = /create function private\.([a-z0-9_]+)/.exec(sql)[1],
    tag = /comment on function[^\n]+ is '([^']+)'/.exec(sql)[1];
  return {
    procedure: { oid: 100, proname: name, ownerTag: tag, _xmin: "123" },
    trigger: { oid: 101, tgname: name, ownerTag: tag, _xmin: "123" },
  };
}

// 显式SQL替身只验证控制流程与错误边界；真实目录版本和实际影响数另在专属PG核对。
test("故障编号非法时不能调用SQL", () => {
  let calls = 0;
  assert.throws(
    () =>
      createTemplateDraftInsertFault("x'", () => {
        calls++;
        return "";
      }),
    /id_invalid/,
  );
  assert.equal(calls, 0);
});
test("安装响应未知时不能猜测并删除目录对象", () => {
  const calls = [];
  const fault = createTemplateDraftInsertFault(id, (sql) => {
    calls.push(sql);
    throw Error("reply lost");
  });
  assert.throws(() => fault.install(), /reply lost/);
  assert.throws(() => fault.remove(), /outcome_unknown/);
  assert.equal(calls.length, 1);
});
test("完整目录凭证后才按相同快照移除，并用新查询确认零对象", () => {
  const calls = [];
  const fault = createTemplateDraftInsertFault(id, (sql) => {
    calls.push(sql);
    return JSON.stringify(
      calls.length === 1
        ? installed(sql)
        : calls.length === 2
          ? { removed: true }
          : { procedure: null, trigger: null },
    );
  });
  const receipt = fault.install();
  assert.match(receipt.name, /^pt5_draft_fault_[a-f0-9]{32}$/);
  assert(calls[0].includes(`new.id='${id}'`));
  fault.remove();
  assert.equal(calls.length, 3);
  assert.match(calls[1], /lock table/);
  assert.match(calls[1], /is distinct from/);
  assert.match(calls[1], /_xmin/);
  fault.remove();
  assert.equal(calls.length, 3);
  assert.throws(() => fault.install(), /already_attempted/);
});
test("缺少安装目录凭证不能进入正常移除", () => {
  let calls = 0;
  const fault = createTemplateDraftInsertFault(id, () => {
    calls++;
    return "{}";
  });
  assert.throws(() => fault.install(), /receipt_invalid/);
  assert.throws(() => fault.remove(), /outcome_unknown/);
  assert.equal(calls, 1);
});
test("清理编号或归属非法时不得执行SQL", () => {
  let calls = 0;
  for (const args of [
    [["bad"], owner],
    [[id], "bad"],
  ])
    assert.throws(
      () =>
        cleanupTemplateDraftRecords(...args, () => {
          calls++;
          return "";
        }),
      /identity_invalid/,
    );
  assert.equal(calls, 0);
});
test("其他人的记录必须在任何DELETE之前拒绝", () => {
  let calls = 0;
  assert.throws(
    () =>
      cleanupTemplateDraftRecords([id], owner, () => {
        calls++;
        return JSON.stringify(snapshot("66666666-6666-4666-8666-666666666666"));
      }),
    /ownership_changed/,
  );
  assert.equal(calls, 1);
});
test("缺表快照不是空集合", () => {
  let calls = 0;
  assert.throws(
    () =>
      cleanupTemplateDraftRecords([id], owner, () => {
        calls++;
        return "{}";
      }),
    /snapshot_invalid/,
  );
  assert.equal(calls, 1);
});
test("错误影响数不能算清理成功", () => {
  let calls = 0;
  assert.throws(
    () => cleanupTemplateDraftRecords([id], owner, () => JSON.stringify(++calls === 1 ? snapshot() : {})),
    /receipt_invalid/,
  );
  assert.equal(calls, 2);
});
test("限定ID去重、正文按SQL字面量保存、删除后独立查零", () => {
  const calls = [],
    counts = Object.fromEntries(tables.map((t) => [t, t === "company_template_document_drafts" ? 1 : 0]));
  const result = cleanupTemplateDraftRecords([id, id], owner, (sql) => {
    calls.push(sql);
    return JSON.stringify(calls.length === 1 ? snapshot() : calls.length === 2 ? counts : empty());
  });
  assert.deepEqual(result, { deleted: counts, alreadyAbsent: false });
  assert.equal(calls.length, 3);
  assert.match(calls[1], /O''Brien/);
  assert.match(calls[1], /get diagnostics changed=row_count/);
  assert.match(calls[1], /draft_cleanup_version_changed/);
  assert(!calls[1].includes(`'${id}','${id}'`));
});
test("提交响应丢失时保留未确认，不输出成功或继续做假读回", () => {
  let calls = 0;
  assert.throws(
    () =>
      cleanupTemplateDraftRecords([id], owner, () => {
        if (++calls === 1) return JSON.stringify(snapshot());
        throw Error("cleanup reply lost");
      }),
    /cleanup reply lost/,
  );
  assert.equal(calls, 2);
});

test("PostgreSQL真实字符串OID目录凭证可以被确认", () => {
  const fault = createTemplateDraftInsertFault(id, (sql) => {
    const value = installed(sql);
    value.procedure.oid = String(value.procedure.oid);
    value.trigger.oid = String(value.trigger.oid);
    return JSON.stringify(value);
  });
  assert.match(fault.install().name, /^pt5_draft_fault_/);
});
