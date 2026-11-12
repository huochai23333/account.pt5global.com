import assert from "node:assert/strict";
import test from "node:test";
import { collectDashboardSourceRuleViolations } from "../dashboard-structure/dashboard-source-rules.mjs";
import { collectAstFacts } from "../dashboard-structure/source-facts.mjs";

function violations(relativePath, source) {
  // 使用真实 TSX 解析器生成与命令行相同的 JSX 信息。
  const { jsx } = collectAstFacts(source, relativePath);
  return collectDashboardSourceRuleViolations({
    relativePath, source, jsxElements: jsx, lineCount: source.split("\n").length,
  });
}

test("基础控件例外只授予指定路径，同名业务组件仍受检查", () => {
  const source = 'export const picker = <input type="file" />;';
  assert.deepEqual(violations("components/dashboard/dashboard-framework-primitives.tsx", source), []);
  const duplicateName = "components/dashboard/domain/dashboard-framework-primitives.tsx";
  assert.match(violations(duplicateName, source).join("\n"), /DashboardFilePicker/);
});

test("读取共享 JSX 事实后仍能识别手写双形态布局", () => {
  const source = 'export const list = <><div className="hidden md:block" /><div className="md:hidden" /></>;';
  const file = "components/dashboard/domain/list.tsx";
  assert.match(violations(file, source).join("\n"), /ResponsiveDataView/);
  assert.deepEqual(violations(file, 'export const list = <ResponsiveDataView />;'), []);
});
