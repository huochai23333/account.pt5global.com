import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  renderModuleGuides,
  describeLearningSource,
} from "./render-module-guides.mjs";
import { scanLearningSources } from "./scan-module-sources.mjs";

// 指南也是证据入口：源码改变后，不能继续向新人展示旧的“已审”职责。
test("模块指南只展示有效审查，源码变化后撤下旧职责", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pt5-guide-"));
  try {
    const source = "export const value = 1;\n";
    fs.writeFileSync(path.join(root, "value.ts"), source);
    const record = {
      repo: "web",
      file: "value.ts",
      status: "retained",
      sha256: createHash("sha256").update(source).digest("hex"),
      responsibilities: ["明确的字段|展示职责"],
      reason: "单一展示边界",
      dataFlow: "输入到展示",
      permissionBoundary: "不授予权限",
      verification: ["合成断言"],
      reviewer: "test",
      reviewMethod: "source_read",
    };
    const moduleEntry = {
      id: "sample",
      title: "合成模块",
      status: "测试",
      purpose: "测试",
      flow: "测试",
      permissions: "测试",
      evidence: "测试",
      maintenance: "测试",
      verification: "测试",
      guide: "guide.md",
      sources: { web: ["value.ts"] },
      tests: {},
      backendObjects: { functions: [], tables: [] },
    };
    const options = { roots: { web: root }, records: [record] };
    renderModuleGuides([moduleEntry], options);
    assert(
      fs
        .readFileSync(path.join(root, "guide.md"), "utf8")
        .includes("已审保留：明确的字段\\|展示职责"),
    );
    fs.writeFileSync(path.join(root, "value.ts"), "export const value = 2;\n");
    renderModuleGuides([moduleEntry], options);
    const stale = fs.readFileSync(path.join(root, "guide.md"), "utf8");
    assert(stale.includes("待重新审查"));
    assert(!stale.includes("明确的字段"));
    assert(
      describeLearningSource("web", "value.ts", null).startsWith("待审候选"),
    );
    assert(
      describeLearningSource("web", "missing.ts", {
        status: "blocked",
      }).startsWith("受限"),
    );
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});

test("扫描受限辅助路径时只登记，不读取不存在的内容", () => {
  const file = "tests/e2e/helpers/accounts.ts";
  const result = scanLearningSources([{ id: "verification" }], null, {
    roots: { web: "C:/not-a-readable-fixture" },
    discover: () => [file],
  });
  assert.deepEqual(result.modules[0].sources.web, [file]);
  assert.equal(result.review.length, 0);
  assert.equal(result.database.length, 0);
});
