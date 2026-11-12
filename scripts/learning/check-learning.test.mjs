import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  validateMarkdownLinks,
  validateModuleMap,
} from "./module-validation.mjs";
import { validateSourceReview } from "./source-validation.mjs";
import { suggestModule } from "./catalogue.mjs";

// 临时文件只位于操作系统专用测试目录；finally 清理本测试创建的确切目录。
function fixture(run) {
  const root = mkdtempSync(path.join(os.tmpdir(), "pt5-learning-"));
  try {
    mkdirSync(path.join(root, "lib"));
    writeFileSync(path.join(root, "guide.md"), "# 合成指南\n");
    writeFileSync(path.join(root, "lib/a.ts"), "export const value = 1;\n");
    return run(root);
  } finally {
    rmSync(root, { recursive: true });
  }
}
function moduleFor(id = "sample") {
  return {
    id,
    title: "合成模块",
    status: "开发",
    purpose: "测试",
    flow: "测试",
    permissions: "测试",
    evidence: "测试",
    maintenance: "测试",
    guide: "guide.md",
    sources: { web: ["lib/a.ts"] },
  };
}
test("完整清单通过，新文件未登记会失败", () =>
  fixture((root) => {
    const map = { modules: [moduleFor()] };
    assert.deepEqual(
      validateModuleMap(map, { web: root }, { web: ["lib/a.ts"] }),
      [],
    );
    assert(
      validateModuleMap(
        map,
        { web: root },
        { web: ["lib/a.ts", "lib/new.ts"] },
      ).some((error) => error.includes("尚未登记")),
    );
  }));
test("重复归属、失效指南及越界源码会失败", () =>
  fixture((root) => {
    const duplicate = { modules: [moduleFor(), moduleFor("other")] };
    assert(
      validateModuleMap(duplicate, { web: root }, { web: [] }).some((error) =>
        error.includes("重复归属"),
      ),
    );
    const invalid = moduleFor();
    invalid.guide = "missing.md";
    invalid.sources.web = ["../outside.ts"];
    const errors = validateModuleMap(
      { modules: [invalid] },
      { web: root },
      { web: [] },
    );
    assert(errors.some((error) => error.includes("指南不存在")));
    assert(errors.some((error) => error.includes("越界")));
  }));
test("文档检查接受编码括号，拒绝不存在的目标", () =>
  fixture((root) => {
    mkdirSync(path.join(root, "(group)"));
    writeFileSync(path.join(root, "(group)/page.ts"), "");
    const guide = path.join(root, "guide.md");
    writeFileSync(
      guide,
      "[页面](%28group%29/page.ts)\n[官网](https://example.invalid)\n",
    );
    assert.deepEqual(validateMarkdownLinks([guide]), []);
    writeFileSync(guide, "[失效](missing.ts)\n");
    assert.equal(validateMarkdownLinks([guide]).length, 1);
  }));

test("源码变化后旧结构扫描失效，不能继续引用旧摘要", () =>
  fixture((root) => {
    const record = {
      repo: "web",
      file: "lib/a.ts",
      sha256: createHash("sha256")
        .update("export const value = 1;\n")
        .digest("hex"),
      lines: 1,
      parseErrors: 0,
    };
    assert.deepEqual(validateSourceReview([record], { web: root }), []);
    writeFileSync(path.join(root, "lib/a.ts"), "export const value = 2;\n");
    assert(
      validateSourceReview([record], { web: root }).some((error) =>
        error.includes("已过期"),
      ),
    );
  }));

// 跨目录入口必须先按实际业务分类，不能被通用 dashboard/app 规则吞掉。
test("学习地图保留跨目录业务归属", () => {
  assert.equal(suggestModule("supabase", "templates/auth/recovery.html"), "auth");
  assert.equal(suggestModule("supabase", "templates/invoice-document-adapter.js"), "templates");
  assert.equal(
    suggestModule("supabase", "scripts/repair-local-gateway.mjs"),
    "tooling",
  );
  assert.equal(
    suggestModule("supabase", "scripts/repair-local-job-endpoints.mjs"),
    "tooling",
  );
  for (const [file, owner] of [
    ["proxy.ts", "workspace"],
    ["app/(auth)/privacy/page.tsx", "public-content"],
    ["components/i18n/language-toggle.tsx", "localization"],
    ["app/api/assistant/run/route.ts", "assistant"],
    ["app/admin/reviews/page.tsx", "reviews"],
    ["app/operator/reimbursements/page.tsx", "expenses"],
    ["components/dashboard/referrals/referrals-client.tsx", "wholesale-people"],
    ["components/dashboard/wholesale/wholesale-customer-mutations.ts", "wholesale-people"],
    ["components/dashboard/wholesale/use-wholesale-incentive-view-model.ts", "wholesale-commission"],
    ["components/dashboard/commission/use-business-parameter-settings-view-model.ts", "business-settings"],
    ["lib/business-parameter-versions.sql", "business-settings"],
    ["components/dashboard/dashboard-order-list-section.tsx", "design-system"],
    ["components/dashboard/wholesale/wholesale-ui.tsx", "design-system"],
    ["lib/wholesale-people-scope.ts", "wholesale-people"],
    ["components/dashboard/dashboard-profile-cards.tsx", "profile"],
    ["components/dashboard/dashboard-feedback.tsx", "design-system"],
  ])
    assert.equal(suggestModule("web", file), owner, file);
});
