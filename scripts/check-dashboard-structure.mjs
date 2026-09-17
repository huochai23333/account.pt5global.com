import { access, readFile } from "node:fs/promises";
import path from "node:path";

import { collectDashboardSourceRuleViolations } from "./dashboard-structure/dashboard-source-rules.mjs";
import { collectInformationHierarchyViolations } from "./dashboard-structure/information-hierarchy.mjs";
import {
  collectAstFacts,
  collectSourceFiles,
} from "./dashboard-structure/source-facts.mjs";

const workspaceRoot = process.cwd();
const dashboardRoot = path.join(workspaceRoot, "components", "dashboard");
const appRoot = path.join(workspaceRoot, "app");
const componentsRoot = path.join(workspaceRoot, "components");
const authMaterialOwners = new Set([
  "components/auth/auth-form-panel.tsx",
  "components/auth/auth-hero-panel.tsx",
  "components/auth/auth-shell.tsx",
]);
const authPagePattern =
  /^app\/\(auth\)\/(?:forgot-password|login|register)\/page\.tsx$/;

const dashboardLabelOwners = new Set([
  "components/dashboard/dashboard-framework-primitives.tsx",
]);
const dashboardMaterialOwners = new Set([
  "components/dashboard/admin-orders/admin-orders-dialog-ui.tsx",
  "components/dashboard/admin-section-placeholder.tsx",
  "components/dashboard/admin-reviews/admin-reviews-ui.tsx",
  "components/dashboard/admin-reviews/media-review-list.tsx",
  "components/dashboard/admin-reviews/profile-change-review-list.tsx",
  "components/dashboard/admin-shell-mobile-nav.tsx",
  "components/dashboard/admin-shell-nav-links.tsx",
  "components/dashboard/admin-tasks/admin-task-media-library-section.tsx",
  "components/dashboard/admin-tasks/admin-task-review-list.tsx",
  "components/dashboard/admin-tasks/admin-tasks-ui.tsx",
  "components/dashboard/ai-assistant/ai-assistant-client.tsx",
  "components/dashboard/ai-assistant/ai-assistant-panel.tsx",
  "components/dashboard/dashboard-centered-loading-state.tsx",
  "components/dashboard/dashboard-dialog.tsx",
  "components/dashboard/dashboard-home/dashboard-home-widget-card.tsx",
  "components/dashboard/dashboard-home/dashboard-home-sections.tsx",
  "components/dashboard/dashboard-home/dashboard-home-todo-section.tsx",
  "components/dashboard/dashboard-media-placeholders.tsx",
  "components/dashboard/dashboard-profile-cards.tsx",
  "components/dashboard/dashboard-section-header.tsx",
  "components/dashboard/dashboard-segmented-tabs.tsx",
  "components/dashboard/dashboard-shared-my/dashboard-account-switcher-section.tsx",
  // 个人资料与认证展示已从页面组装器拆出，原有材质只允许在该展示层继续使用。
  "components/dashboard/dashboard-shared-my/dashboard-my-content-sections.tsx",
  "components/dashboard/dashboard-shared-my/dashboard-my-section-ui.tsx",
  "components/dashboard/dashboard-shared-my/dashboard-shared-my-dialogs.tsx",
  "components/dashboard/dashboard-shared-my/dashboard-shared-my-sections.tsx",
  "components/dashboard/dashboard-shared-photo-stack-preview.tsx",
  "components/dashboard/exchange-rates/exchange-rates-latest-card.tsx",
  "components/dashboard/salesman-tasks/salesman-tasks-ui.tsx",
  "components/dashboard/team-management/team-management-summary-sections.tsx",
  "components/dashboard/team-management/team-management-ui.tsx",
  "components/dashboard/workspace-customization-sidebar.tsx",
  "components/dashboard/workspace-feedback/workspace-feedback-success-toast.tsx",
  "components/dashboard/workspace-loading-shell.tsx",
  "components/dashboard/workspace-account-menu.tsx",
  "components/dashboard/workspace-announcement-action.tsx",
]);

const violations = await collectDashboardSourceRuleViolations({
  dashboardRoot,
  workspaceRoot,
});

/**
 * 下面的规则覆盖全站，而不只覆盖工作台目录。
 * 色值和控件限制放在结构守卫里，可以在代码评审前立即阻止设计系统再次分叉。
 */
const allSourceFiles = [
  ...(await collectSourceFiles(appRoot)),
  ...(await collectSourceFiles(componentsRoot)),
];

for (const absolutePath of allSourceFiles) {
  const source = await readFile(absolutePath, "utf8");
  const relativePath = path
    .relative(workspaceRoot, absolutePath)
    .replaceAll("\\", "/");
  const ast = collectAstFacts(source, absolutePath);

  violations.push(
    ...collectInformationHierarchyViolations({
      jsxElements: ast.jsx,
      relativePath,
    }),
  );

  for (const invalidHref of ast.invalidHrefValues) {
    violations.push(
      `${relativePath}:${invalidHref.line}: href 不能包含 CSS 变量；请检查锚点或页面地址是否被样式替换。`,
    );
  }

  if (/#[0-9a-fA-F]{3,8}\b|rgba?\s*\(/.test(source)) {
    violations.push(
      `${relativePath}: TS/TSX 禁止硬编码颜色；请改用 theme.css 语义令牌。`,
    );
  }

  const isUiControlFile = relativePath.startsWith("components/ui/");
  for (const element of ast.jsx) {
    if (["select", "option"].includes(element.tagName)) {
      violations.push(
        `${relativePath}:${element.line}: 原生 select/option 会产生系统方形菜单；请使用 components/ui/select。`,
      );
    }

    if (
      !isUiControlFile &&
      ["input", "textarea", "button"].includes(element.tagName)
    ) {
      violations.push(
        `${relativePath}:${element.line}: 原生表单控件只能出现在 components/ui；业务组件必须复用基础控件。`,
      );
    }

    if (
      relativePath.startsWith("components/dashboard/") &&
      element.tagName === "label" &&
      !dashboardLabelOwners.has(relativePath)
    ) {
      violations.push(
        `${relativePath}:${element.line}: 业务层不能直接渲染 label；请使用 Field、DashboardFormField 或 ChoiceField。`,
      );
    }

    if (
      relativePath.startsWith("components/dashboard/") &&
      element.tagName === "Button" &&
      /className=/.test(element.classText) &&
      /(?:\bbg-|\bborder(?:-|\b)|\brounded-|\bshadow-|\b(?:min-|max-)?h-|\b(?:p|px|py|pt|pr|pb|pl)-|\btext-|\bfont-|\bleading-|\bwhitespace-|\bhover:|\bfocus:|\bring-)/.test(
        element.classText,
      )
    ) {
      violations.push(
        `${relativePath}:${element.line}: Button 的 className 只能控制宽度、定位和外部间距；请使用 variant、size 或 wrap。`,
      );
    }

    if (
      ["Select", "DatePicker"].includes(element.tagName) &&
      /className=/.test(element.classText) &&
      /(?:\bbg-|\bborder(?:-|\b)|\brounded-|\b(?:min-|max-)?h-|focus:|\bring-)/.test(
        element.classText,
      )
    ) {
      violations.push(
        `${relativePath}:${element.line}: ${element.tagName} 的 className 只能控制布局，不能覆盖颜色、高度、圆角或焦点样式。`,
      );
    }
  }

  if (/type=["'](?:date|month|datetime-local)["']/.test(source)) {
    violations.push(
      `${relativePath}: 原生日期控件会产生系统弹层；请使用 components/ui/date-picker。`,
    );
  }

  // 图表色权重较高，只能表达数据系列；普通表格分隔线必须使用低强调的边界语义。
  if (/divide-\[var\(--chart-\d\)\]/.test(source)) {
    violations.push(
      `${relativePath}: 图表色不能用作列表或表格分隔线；请使用 divide-border-subtle。`,
    );
  }

  if (/\b(?:WholesaleSelect|taskSelectClassName)\b/.test(source)) {
    violations.push(
      `${relativePath}: 领域 Select 包装和完整样式常量已移除；请直接使用全站 Select。`,
    );
  }

  if (
    !isUiControlFile &&
    /(?:function|const)\s+\w*(?:DatePicker|MonthPicker|DateTimePicker)\b/.test(
      source,
    )
  ) {
    violations.push(
      `${relativePath}: 领域日期包装会重新分叉交互规则；请直接使用全站 DatePicker。`,
    );
  }

  for (const statusFunction of ast.statusColorFunctions) {
    violations.push(
      `${relativePath}:${statusFunction.line}: ${statusFunction.name} 不能返回颜色类名；请只映射 StatusBadge tone。`,
    );
  }

  if (relativePath.startsWith("components/dashboard/")) {
    const rawMaterialElement = ast.jsx.find((element) =>
      /rounded-\[|(?:bg|border)-white(?:\/|\b)|shadow-\[var\(--surface-shadow/.test(
        element.classText,
      ),
    );
    if (rawMaterialElement) {
      violations.push(
        `${relativePath}:${rawMaterialElement.line}: 业务层禁止白色面板、任意圆角和任意表面阴影；请改用语义令牌。`,
      );
    }

    const semanticMaterialElement = ast.jsx.find((element) =>
      /shadow-surface-(?:panel|inset|interactive|floating)/.test(
        element.classText,
      ),
    );
    if (semanticMaterialElement && !dashboardMaterialOwners.has(relativePath)) {
      violations.push(
        `${relativePath}:${semanticMaterialElement.line}: 非共享组件不能持有表面阴影；请使用 Surface、RecordCard、MetricCard 或经审查的中层组件。`,
      );
    }
  }

  const isPageOrClient = /(?:\/page|(?:^|\/)[^/]*-client)\.tsx$/.test(
    relativePath,
  );
  if (isPageOrClient) {
    const importsDataLayer = ast.imports.some((modulePath) =>
      /(?:queries|mutations|supabase-server|\/(?:query|mutation)(?:-|\/|$))/.test(
        modulePath,
      ),
    );
    const rendersBusinessDetail = ast.jsx.some((element) =>
      /(?:Table|Dialog)$/.test(element.tagName),
    );
    if (importsDataLayer && rendersBusinessDetail) {
      violations.push(
        `${relativePath}: Page/Client 不能同时导入查询或 mutation 并渲染业务表格/弹窗；请拆到 renderer、view-model 和 section。`,
      );
    }
  }

  /*
   * 认证照片和玻璃材质是经过确认的页面级变体，但只能由认证中层组件持有。
   * 页面仍然只能组装文案和表单，不能重新复制图片、卡片或基础控件样式。
   */
  const ownsAuthMaterial = authMaterialOwners.has(relativePath);
  const hasAuthMaterialClass =
    /auth-(?:card-surface|grid-dots|aside-overlay|aside-glow|form-surface)/.test(
      source,
    );
  if (hasAuthMaterialClass && !ownsAuthMaterial) {
    violations.push(
      `${relativePath}: 认证材质只能由 AuthShell、AuthHeroPanel 或 AuthFormPanel 持有。`,
    );
  }

  if (
    /zhang-kaiyv-Xqf2ph7vrgc-unsplash/.test(source) &&
    relativePath !== "components/auth/auth-hero-panel.tsx"
  ) {
    violations.push(`${relativePath}: 认证背景图片只能由 AuthHeroPanel 引用。`);
  }

  if (authPagePattern.test(relativePath)) {
    if (/@\/components\/ui\/|className=/.test(source)) {
      violations.push(
        `${relativePath}: 认证页面只负责组装 AuthShell 与表单，不能直接持有基础控件或视觉类名。`,
      );
    }
  }

  if (/\b(?:AuthFeedback|PageBanner|NoticeTone)\b/.test(source)) {
    violations.push(
      `${relativePath}: 反馈必须使用全站 FeedbackNotice 与 FeedbackTone。`,
    );
  }

  const lineCount = source.split(/\r?\n/).length;
  if (
    lineCount > 400 &&
    (relativePath.startsWith("components/auth/") ||
      relativePath.startsWith("components/ui/"))
  ) {
    violations.push(
      `${relativePath}: 认证或基础 UI 文件超过 400 行，请按 view-model 或展示区块拆分。`,
    );
  }
}

const responsiveWhitelist = new Set([
  "components/dashboard/admin-shell.tsx",
  "components/dashboard/dashboard-home/dashboard-home-customizer.tsx",
]);

for (const absolutePath of await collectSourceFiles(dashboardRoot)) {
  const source = await readFile(absolutePath, "utf8");
  const relativePath = path
    .relative(workspaceRoot, absolutePath)
    .replaceAll("\\", "/");
  const lineCount = source.split(/\r?\n/).length;
  const ast = collectAstFacts(source, absolutePath);

  if (lineCount > 400) {
    violations.push(
      `${relativePath}: 工作台文件超过 400 行，请先按查询、状态、弹窗或展示区块拆分。`,
    );
  }

  const classTexts = ast.jsx.map((element) => element.classText);
  const hasManualResponsivePair = ["md", "lg"].some(
    (breakpoint) =>
      classTexts.some((classText) =>
        new RegExp(`\\bhidden\\s+${breakpoint}:block`).test(classText),
      ) &&
      classTexts.some((classText) =>
        new RegExp(`\\b${breakpoint}:hidden`).test(classText),
      ),
  );
  const usesResponsiveDataView = ast.jsx.some(
    (element) => element.tagName === "ResponsiveDataView",
  );

  if (
    !responsiveWhitelist.has(relativePath) &&
    hasManualResponsivePair &&
    !usesResponsiveDataView
  ) {
    violations.push(
      `${relativePath}: 数据双形态视图必须使用 ResponsiveDataView。`,
    );
  }
}

const cssFiles = [
  "app/theme.css",
  "app/auth.css",
  "app/root.css",
  "app/workspace.css",
];
for (const relativePath of cssFiles) {
  const source = await readFile(path.join(workspaceRoot, relativePath), "utf8");
  if (/\.dark\b|@custom-variant\s+dark\b/.test(source)) {
    violations.push(
      `${relativePath}: 项目不提供深色模式，禁止重新引入 .dark 或 dark 变体。`,
    );
  }

  if (/\.legal-page-background\b|\.public-state-background\b/.test(source)) {
    violations.push(
      `${relativePath}: 法律页和异常页必须继续复用工作台公共表面。`,
    );
  }

  if (
    relativePath !== "app/auth.css" &&
    /\.auth-(?:card-surface|grid-dots|aside-overlay|aside-glow|form-surface)\b/.test(
      source,
    )
  ) {
    violations.push(`${relativePath}: 认证材质类只能定义在 app/auth.css。`);
  }
}

// 认证英雄区依赖这张本地图片；缺失时 Next.js 构建也无法生成稳定的尺寸和模糊占位。
try {
  await access(
    path.join(
      workspaceRoot,
      "public",
      "images",
      "zhang-kaiyv-Xqf2ph7vrgc-unsplash.jpg",
    ),
  );
} catch {
  violations.push(
    "public/images/zhang-kaiyv-Xqf2ph7vrgc-unsplash.jpg: 认证背景图片缺失。",
  );
}

if (violations.length > 0) {
  console.error("工作台共享结构检查失败：\n");
  violations.forEach((violation) => console.error(`- ${violation}`));
  process.exitCode = 1;
} else {
  console.log("工作台共享结构检查通过。");
}
