import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import test from "node:test";
import { validateManualReviews } from "./manual-review.mjs";

// 在临时源码改变后，旧审查必须失效，不能靠沿用状态继续获得完整验收。
test("人工审查拒绝过期摘要、空判断和未完成项", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pt5-review-"));
  try {
    const source = "export const amount = 1;\n";
    fs.writeFileSync(path.join(root, "a.ts"), source);
    const entry = {
      repo: "web",
      file: "a.ts",
      status: "retained",
      sha256: createHash("sha256").update(source).digest("hex"),
      responsibilities: ["纯值导出"],
      reason: "单一职责",
      dataFlow: "常量到调用者",
      permissionBoundary: "无授权决策",
      reviewer: "test",
      reviewMethod: "source_read",
      verification: ["合成断言"],
    };
    const expected = new Set(["web:a.ts"]);
    assert.deepEqual(
      validateManualReviews([entry], expected, { web: root }, true),
      [],
    );
    fs.writeFileSync(path.join(root, "a.ts"), "export const amount = 2;\n");
    assert(
      validateManualReviews([entry], expected, { web: root }).some((error) =>
        error.includes("过期"),
      ),
    );
    assert(
      validateManualReviews([{ ...entry, reason: "" }], expected, {
        web: root,
      }).some((error) => error.includes("缺少 reason")),
    );
    const pending = { ...entry, status: "pending" };
    assert.deepEqual(
      validateManualReviews([pending], expected, { web: root }),
      [],
    );
    assert(
      validateManualReviews([pending], expected, { web: root }, true).some(
        (error) => error.includes("尚未完成"),
      ),
    );
  } finally {
    fs.rmSync(root, { recursive: true });
  }
});
