const rules = [
  {
    message: "工作台确认操作必须使用 DashboardConfirmProvider，不能再调用 window.confirm。",
    pattern: /window\.confirm\s*\(/,
  },
  {
    owner: "components/dashboard/dashboard-page-shell.tsx",
    message: "页面宽度与间距必须由 DashboardPageShell 提供，领域页面不能复制外壳类名。",
    pattern: /mx-auto flex w-full max-w-\[1320px\] flex-col/,
  },
  {
    owner: "components/dashboard/dashboard-form-dialog.tsx",
    message: "弹窗输入样式必须复用 DashboardFormField 或 dashboardFormInputClassName。",
    pattern: /const\s+(?:input|textarea)ClassName\s*=/,
  },
  {
    owner: "components/dashboard/dashboard-framework-primitives.tsx",
    message: "文件入口必须使用 DashboardFilePicker，领域组件不能直接渲染文件输入框。",
    pattern: /type=["']file["']/,
  },
  {
    message: "旧分页外壳已经移除，请使用 DashboardPaginationFooter。",
    pattern: /dashboard-pagination-controls|DashboardPaginationControls/,
  },
  {
    message: "领域组件不能新增状态标签组件，请直接使用全站 StatusBadge 并只映射 tone。",
    pattern:
      /\b(?:InlineChip|DashboardPill|WholesaleStatusBadge)\b|function\s+StatusBadge\s*\(/,
  },
  {
    owner: "components/dashboard/dashboard-section-panel.tsx",
    message: "搜索图标与输入文字的间距必须由 DashboardSearchInput 统一管理，不能在领域页面绝对定位图标。",
    pattern: /<Search\b[^>]*\babsolute\b/,
  },
  {
    owner: "components/dashboard/dashboard-resource-filter-section.tsx",
    message: "业务筛选区必须使用 DashboardResourceFilterSection，确保移动搜索常驻、条件折叠和恢复入口一致。",
    pattern: /<DashboardFilterPanel\b/,
  },
];

const responsiveOwners = new Set([
  "components/dashboard/admin-shell.tsx",
  "components/dashboard/dashboard-home/dashboard-home-customizer.tsx",
]);

export function collectDashboardSourceRuleViolations({
  source,
  relativePath,
  jsxElements,
  lineCount,
}) {
  const violations = [];
  // 例外属于指定组件。其他目录的同名文件仍应遵守规则。
  for (const rule of rules) {
    if (relativePath === rule.owner || !rule.pattern.test(source)) continue;
    violations.push(`${relativePath}: ${rule.message}`);
  }

  if (lineCount > 400) {
    violations.push(
      `${relativePath}: 工作台文件超过 400 行，请先按查询、状态、弹窗或展示区块拆分。`,
    );
  }

  const classTexts = jsxElements.map((element) => element.classText);
  const hasManualResponsivePair = ["md", "lg"].some((breakpoint) =>
    classTexts.some((classText) => new RegExp(`\\bhidden\\s+${breakpoint}:block`).test(classText))
    && classTexts.some((classText) => new RegExp(`\\b${breakpoint}:hidden`).test(classText)),
  );
  const usesResponsiveDataView = jsxElements.some((element) => element.tagName === "ResponsiveDataView");
  if (!responsiveOwners.has(relativePath) && hasManualResponsivePair && !usesResponsiveDataView) {
    violations.push(`${relativePath}: 数据双形态视图必须使用 ResponsiveDataView。`);
  }
  return violations;
}
