import assert from "node:assert/strict";
import test from "node:test";
import { compareE2eCohorts } from "./e2e-cohorts.mjs";

// 用合成文件名验证统计边界，不加载账号辅助文件，也不执行原始 E2E。
test("新增测试不会改变历史集合或冒充历史结果", () => {
  assert.deepEqual(compareE2eCohorts(["a"], ["a", "b"]), {
    added: ["b"],
    removed: [],
    renamed: [],
  });
});
test("删除历史入口会明确报告", () => {
  assert.deepEqual(compareE2eCohorts(["a", "b"], ["a"]).removed, ["b"]);
});
test("显式改名不会被重复计为新增和删除", () => {
  assert.deepEqual(compareE2eCohorts(["a"], ["b"], { a: "b" }), {
    added: [],
    removed: [],
    renamed: [{ before: "a", after: "b" }],
  });
});
test("拒绝重复清单、伪造改名和多对一改名", () => {
  assert.throws(() => compareE2eCohorts(["a", "a"], []), /重复/);
  assert.throws(() => compareE2eCohorts(["a"], ["b"], { x: "b" }), /无效/);
  assert.throws(() => compareE2eCohorts(["a", "b"], ["c"], { a: "c", b: "c" }), /无效/);
  assert.throws(() => compareE2eCohorts(["a"], ["a", "b"], { a: "b" }), /无效/);
});
