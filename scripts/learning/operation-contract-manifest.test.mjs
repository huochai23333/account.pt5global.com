import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const checker = fileURLToPath(new URL("../check-operation-contracts.mjs", import.meta.url));

const contract = {
  operationId: "fixture-operation",
  trigger: "测试触发",
  completionEvidence: "合成业务编号",
  timeoutSeconds: null,
  retryDelaysSeconds: [],
  idempotency: "重复提交保留相同记录",
  failureMessage: "保存失败",
  ownerRole: "administrator",
  sources: ["app/fixture.ts"],
};

async function checkFixture(t, manifest) {
  const root = await mkdtemp(path.join(tmpdir(), "pt5-operation-contract-"));
  // 本例只建立脚本扫描需要的最小目录，退出时清理整个专属夹具。
  t.after(() => rm(root, { recursive: true, force: true }));
  await Promise.all(["app", "components", "lib", "config"].map((name) => mkdir(path.join(root, name))));
  await Promise.all([
    writeFile(path.join(root, "app/fixture.ts"), "export const fixture = 1;"),
    writeFile(path.join(root, "config/operation-contracts.json"), JSON.stringify(manifest)),
  ]);
  return spawnSync(process.execPath, [checker], { cwd: root, encoding: "utf8" });
}

test("接受实际存在的 TS 源码、空重试列表及未配置的超时", async (t) => {
  const result = await checkFixture(t, [contract]);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /1 项关键契约/);
});

test("拒绝重复编号、空证据及无效时间", async (t) => {
  const result = await checkFixture(t, [
    contract,
    { ...contract, completionEvidence: "  ", timeoutSeconds: -1, retryDelaysSeconds: ["later"] },
  ]);
  assert.equal(result.status, 1);
  for (const field of ["operationId", "completionEvidence", "timeoutSeconds", "retryDelaysSeconds"]) {
    assert.match(result.stderr, new RegExp(field));
  }
});

test("拒绝没有来源、把目录当作来源及绕出源码树的路径", async (t) => {
  const result = await checkFixture(t, [
    { ...contract, sources: [] },
    { ...contract, operationId: "directory", sources: ["app"] },
    { ...contract, operationId: "outside", sources: ["app/../config/operation-contracts.json"] },
  ]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /fixture-operation:.*sources/);
  assert.match(result.stderr, /directory:.*app/);
  assert.match(result.stderr, /outside:.*config/);
});

test("仅后台任务显式登记 Edge 入口后才可以没有 Web 来源", async (t) => {
  const backendOnly = {
    ...contract, sources: [], backendEntry: "supabase/functions/example-task/index.ts",
  };
  const result = await checkFixture(t, [backendOnly]);
  assert.equal(result.status, 0, result.stderr);
  const invalid = await checkFixture(t, [{ ...backendOnly, backendEntry: "supabase/functions/../index.ts" }]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /backendEntry/);
});
