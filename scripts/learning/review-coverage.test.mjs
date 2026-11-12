import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  renderReviewCoverage,
  validateReviewCoverage,
} from "./review-coverage.mjs";

test("覆盖表只计有效源码审查，源码变化后旧表和已审数量一同失效", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pt5-review-coverage-"));
  const file = path.join(root, "source.ts");
  try {
    const source = "export const count = 1;\n";
    fs.writeFileSync(file, source);
    const modules = [
      {
        id: "one",
        title: "示例模块",
        sources: { web: ["source.ts", "pending.ts", "blocked.ts"] },
      },
    ];
    const records = [
      {
        repo: "web",
        file: "source.ts",
        status: "retained",
        sha256: createHash("sha256").update(source).digest("hex"),
        responsibilities: ["合成常量"],
        reason: "单一职责",
        dataFlow: "常量到调用方",
        permissionBoundary: "无写入",
        reviewer: "test",
        reviewMethod: "source_read",
        verification: ["synthetic"],
      },
      { repo: "web", file: "pending.ts", status: "pending" },
      { repo: "web", file: "blocked.ts", status: "blocked" },
    ];
    const before = renderReviewCoverage(modules, records, { web: root });
    assert(before.includes("| **总计** | 1 | 1 | 1 | 3 |"));
    assert.deepEqual(
      validateReviewCoverage(
        before.replaceAll("\n", "\r\n"),
        modules,
        records,
        { web: root },
      ),
      [],
    );
    // pending/blocked 文件特意不存在：汇总不得读取这两份内容。
    fs.writeFileSync(file, "export const count = 2;\n");
    const after = renderReviewCoverage(modules, records, { web: root });
    assert(after.includes("| **总计** | 0 | 2 | 1 | 3 |"));
    assert.equal(
      validateReviewCoverage(before, modules, records, { web: root }).length,
      1,
    );
    assert.deepEqual(
      validateReviewCoverage(after, modules, records, { web: root }),
      [],
    );
    assert.equal(records[0].status, "retained");
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(root);
  }
});
