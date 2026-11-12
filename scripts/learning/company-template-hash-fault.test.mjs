import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import ts from "typescript";
import { createCompanyTemplateHashFault } from "../../tests/test-support/company-template-hash-fault.ts";
import { cleanupFixtureResources } from "../../tests/test-support/fixture-cleanup-sequence.ts";

const html = "<!doctype html><html><body>local hash fixture</body></html>";
const input = {
  templateId: "a3200000-0000-4000-8000-000000000001",
  versionId: "a3200000-0000-4000-8000-000000000003",
  originalHash: createHash("sha256").update(html).digest("hex"),
  apiOrigin: "http://127.0.0.1:48051",
  sdkOrigin: "http://127.0.0.1:48051",
};
function graph() {
  return {
    template: {
      record: {
        id: input.templateId,
        current_version_id: input.versionId,
        status: "active",
        revision: 1,
      },
      version: "100",
    },
    version: {
      record: {
        id: input.versionId,
        template_id: input.templateId,
        html_content: html,
        html_sha256: input.originalHash,
        version_number: 1,
      },
      version: "101",
    },
  };
}
/** 内存端口用于缺失/未知响应，不代表真实SQL影响行数；原生事务和触发器另验。 */
function harness() {
  let current = graph(),
    calls = 0,
    updates = 0;
  const modes = {};
  const execute = (sql) => {
    calls++;
    if (!sql.startsWith("begin;")) return JSON.stringify(current);
    const match = /actual is distinct from '((?:''|[^'])*)'::jsonb/.exec(sql);
    assert(match);
    const expected = JSON.parse(match[1].replaceAll("''", "'"));
    if (JSON.stringify(expected) !== JSON.stringify(current))
      throw Error("template_hash_fault_version_changed");
    updates++;
    if (modes.zero) throw Error("template_hash_fault_zero_affected");
    current.version.record.html_sha256 =
      updates % 2 ? "0".repeat(64) : input.originalHash;
    if (!modes.sameVersion)
      current.version.version = String(Number(current.version.version) + 1);
    if (modes.changedParent) current.template.record.revision++;
    if (modes.lost === updates) throw Error("reply lost after commit");
    return JSON.stringify({
      changed: modes.badReceipt ? 0 : 1,
      graph: current,
    });
  };
  const fixture = createCompanyTemplateHashFault(execute, input);
  return {
    fixture,
    modes,
    get graph() {
      return current;
    },
    set graph(value) {
      current = value;
    },
    get calls() {
      return calls;
    },
  };
}
test("身份/摘要/本机来源不符在首次SQL前拒绝", () => {
  let calls = 0;
  for (const change of [
    { templateId: "bad" },
    { versionId: "bad" },
    { originalHash: "0".repeat(64) },
    { originalHash: "short" },
    { apiOrigin: "https://example.test", sdkOrigin: "https://example.test" },
    { sdkOrigin: "http://127.0.0.1:48052" },
    { apiOrigin: "invalid" },
  ])
    assert.throws(() =>
      createCompanyTemplateHashFault(
        () => {
          calls++;
          return "";
        },
        { ...input, ...change },
      ),
    );
  assert.equal(calls, 0);
});
test("未启动恢复不访问SQL；返回图和证据副本不修改内部基准", () => {
  const h = harness();
  assert.deepEqual(h.fixture.restore(), { restored: false, inactive: true });
  assert.equal(h.calls, 0);
  const armed = h.fixture.arm();
  armed.version.record.html_content = "mutated copy";
  h.fixture.evidence().injected.version.version = "999";
  assert.equal(h.fixture.verify().version.record.html_content, html);
  assert.equal(h.fixture.restore().changed, 1);
  assert.equal(h.graph.version.record.html_sha256, input.originalHash);
  assert.notEqual(h.graph.version.version, "101");
  assert.equal(h.fixture.restore().repeated, true);
});
test("原图缺失、关联不符、摘要失真和非字符串xmin拒绝", () => {
  for (const change of [
    (value) => (value.version.record.template_id = "wrong"),
    (value) => (value.template.record.current_version_id = "wrong"),
    (value) => (value.version.record.html_content = "different"),
    (value) => (value.version.version = 101),
  ]) {
    const h = harness();
    change(h.graph);
    assert.throws(
      () => h.fixture.arm(),
      /graph_invalid|original_digest_invalid/,
    );
    assert.equal(h.fixture.evidence().attempted, false);
  }
});
test("零影响、缺少新版本或父记录变化不能伪造注入凭证", () => {
  for (const mode of ["zero", "sameVersion", "changedParent", "badReceipt"]) {
    const h = harness();
    h.modes[mode] = true;
    assert.throws(
      () => h.fixture.arm(),
      /zero_affected|transition_invalid|receipt_invalid/,
    );
    assert.throws(() => h.fixture.restore(), /outcome_unknown/);
    assert.equal(h.fixture.evidence().restored, undefined);
  }
});
test("注入提交回包丢失时不接纳当前图为恢复基准", () => {
  const h = harness();
  h.modes.lost = 1;
  assert.throws(() => h.fixture.arm(), /reply lost/);
  assert.equal(h.graph.version.record.html_sha256, "0".repeat(64));
  assert.throws(() => h.fixture.restore(), /outcome_unknown/);
});
test("恢复前同值新版本拒绝旧凭证", () => {
  const h = harness();
  h.fixture.arm();
  h.graph.version.version = "999";
  assert.throws(() => h.fixture.verify(), /not_active/);
  assert.throws(() => h.fixture.restore(), /version_changed/);
  assert.equal(h.graph.version.record.html_sha256, "0".repeat(64));
});
test("恢复已经提交但回包丢失仍保持未知，重试不盲写", () => {
  const h = harness();
  h.fixture.arm();
  h.modes.lost = 2;
  assert.throws(() => h.fixture.restore(), /reply lost/);
  assert.equal(h.graph.version.record.html_sha256, input.originalHash);
  assert.equal(h.fixture.evidence().restored, undefined);
  assert.throws(() => h.fixture.restore(), /version_changed/);
});

/** 只编译当前安全收尾辅助；原测试账号、管理员提供器与产品模块均不参与执行。 */
function finalizer() {
  const source = fs.readFileSync(
    "tests/e2e/helpers/company-template-case-lifecycle.ts",
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.CommonJS,
    },
  }).outputText;
  const compiled = { exports: {} };
  new Function("module", "exports", "require", code)(
    compiled,
    compiled.exports,
    (name) => {
      assert.equal(name, "../../test-support/fixture-cleanup-sequence");
      return { cleanupFixtureResources };
    },
  );
  return compiled.exports.finalizeCompanyTemplateCase;
}
test("正文、恢复及附件失败全部保留，先排空关闭再回收", async () => {
  const calls = [],
    body = Error("body"),
    restore = Error("restore"),
    attach = Error("attach");
  await assert.rejects(
    finalizer()(
      {
        isClosed: () => false,
        unrouteAll: async () => calls.push("drain"),
        close: async () => calls.push("close"),
      },
      {
        attach: async () => {
          calls.push("attach");
          throw attach;
        },
      },
      async () => {
        calls.push("restore");
        throw restore;
      },
      { error: body },
    ),
    (error) =>
      error instanceof AggregateError &&
      error.errors.length === 3 &&
      error.errors[0] === body &&
      error.errors[1] === restore &&
      error.errors[2] === attach,
  );
  assert.deepEqual(calls, ["drain", "close", "restore", "attach"]);
});
test("关闭失败保留故障证据、禁止恢复或删除，并仍尝试附件", async () => {
  const calls = [],
    close = Error("close");
  let evidence;
  await assert.rejects(
    finalizer()(
      {
        isClosed: () => false,
        unrouteAll: async () => {},
        close: async () => {
          throw close;
        },
      },
      {
        attach: async (_, value) => {
          evidence = JSON.parse(value.body.toString());
        },
      },
      async () => calls.push("unsafe"),
      undefined,
      () => ({ attempted: true, restored: false }),
    ),
    (error) =>
      error instanceof AggregateError &&
      error.errors[0] === close &&
      error.errors[1].message === "company_template_case_page_not_closed",
  );
  assert.equal(evidence.cleanupConfirmed, false);
  assert.equal(evidence.evidence.restored, false);
  assert.deepEqual(calls, []);
});
