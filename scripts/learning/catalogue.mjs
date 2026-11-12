import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

export const webRoot = path.resolve(import.meta.dirname, "../..");
export const repositoryRoots = {
  web: webRoot,
  supabase: path.resolve(webRoot, "../PT5-dropshipping-supabase"),
};
const sourceDirectories = {
  web: [
    "app",
    "components",
    "lib",
    "i18n",
    "messages",
    "scripts",
    "tests",
    "config",
    "examples",
  ],
  supabase: [
    "supabase/functions",
    "supabase/migrations",
    "supabase/tests",
    "supabase/rollbacks",
    "scripts",
    "templates",
    "logistics-supabase/supabase/functions",
  ],
};
const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".js",
  ".css",
  ".html",
  ".json",
  ".sql",
  ".ps1",
  ".toml",
]);
const generatedNames = new Set([
  "module-map.json",
  "source-review.json",
  "database-index.json",
]);

/** 只扫描约定的源码目录；本地环境、密钥、种子账号和输出目录从不进入学习清单。 */
export function discoverSources(repo) {
  const root = repositoryRoots[repo];
  const result = [];
  function walk(relative) {
    for (const entry of readdirSync(path.join(root, relative), {
      withFileTypes: true,
    })) {
      const child = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!["node_modules", ".temp", "__snapshots__"].includes(entry.name))
          walk(child);
      } else if (
        sourceExtensions.has(path.extname(entry.name)) &&
        !generatedNames.has(entry.name)
      ) {
        result.push(child);
      }
    }
  }
  sourceDirectories[repo].forEach(walk);
  // 根目录配置也是维护入口；使用明确白名单，避免把环境文件意外写入索引。
  const rootFiles =
    repo === "web"
      ? [
          "proxy.ts",
          "next.config.ts",
          "playwright.config.ts",
          "eslint.config.mjs",
          "postcss.config.mjs",
          "tsconfig.json",
          "package.json",
        ]
      : ["supabase/config.toml", "restore-local-seed.ps1"];
  return [...result, ...rootFiles].sort();
}

export function readModuleMap() {
  return JSON.parse(
    readFileSync(path.join(webRoot, "docs/onboarding/module-map.json"), "utf8"),
  );
}

/**
 * 优先按所属目录确定模块，再按明确的领域文件名分类。
 * 这是生成候选清单的规则；最终归属保存在可评审的 module-map.json 中。
 */
export function suggestModule(repo, file) {
  // 认证邮件不是业务单据模板；两者即使共用templates目录，也必须进入不同的维护指南。
  if (repo === "supabase" && file.startsWith("templates/auth/")) return "auth";
  // 先处理跨目录的真实业务入口，避免通用 app/dashboard 规则把功能归错模块。
  if (repo === "web") {
    // 路由分组用于布局；公开帮助、条款和隐私正文属于内容维护，不是认证实现。
    if (/^app\/\(auth\)\/(help|privacy|terms)\/page\.tsx$/.test(file))
      return "public-content";
    if (file === "proxy.ts" || file === "lib/company-config.ts")
      return "workspace";
    if (file.startsWith("components/i18n/")) return "localization";
    // 首页待办服务和公告卡只由首页消费；公告内容、审核等仍归各自领域。
    if (file === "lib/user-todos.ts" || file === "components/dashboard/dashboard-home/dashboard-home-announcements-widget.tsx")
      return "home";
    if (file.startsWith("app/api/assistant/")) return "assistant";
    if (/^app\/api\/(admin\/people|salesman\/people|people\/note)\//.test(file))
      return "accounts";
    if (/\/reviews\/page\.tsx$/.test(file)) return "reviews";
    if (/\/reimbursements\/page\.tsx$/.test(file)) return "expenses";
    if (file === "lib/password-recovery-session.ts") return "auth";
    if (
      /^components\/dashboard\/referrals\//.test(file) ||
      file === "lib/referrals.ts" ||
      file === "components/dashboard/wholesale/wholesale-account-dialog.tsx"
    )
      return "wholesale-people";
    // 客户资料弹窗和写入由客户目录消费，订单只读取客户选项。提成视图由提成页面消费。
    if (/^components\/dashboard\/wholesale\/wholesale-customer-/.test(file))
      return "wholesale-people";
    if (file === "components/dashboard/wholesale/use-wholesale-incentive-view-model.ts")
      return "wholesale-commission";
    if (file === "components/dashboard/client-business-add-dialog.tsx")
      return "accounts";
    // 测试扫描用文件基本名模拟 lib 路径。这个用例验证资料登记和对象，由资料库指南收录。
    if (file === "lib/wholesale-customer-document-upload-race.spec.ts")
      return "documents";
    if (
      /dashboard-profile-cards|dashboard-shared-photo-stack-preview/.test(file)
    )
      return "profile";
    if (
      /^components\/dashboard\/dashboard-(centered-loading-state|collection-section|confirm-provider|dialog(?:-focus)?|feedback|form-dialog|framework-primitives|media-placeholders|media-preview|order-filter-section|page-shell|paged-records|resource-filter-section|section-header|section-panel|segmented-tabs)\./.test(
        file,
      )
    )
      return "design-system";
    // 旅游订单、批发订单和物流共用该分页外壳。
    if (
      file === "components/dashboard/dashboard-order-list-section.tsx" ||
      file === "components/dashboard/wholesale/wholesale-ui.tsx"
    )
      return "design-system";
  }
  // 本地容器与任务地址修复是环境维护入口，不属于业务测试实现。
  if (/^scripts\/repair-local-(vector|job-endpoints|gateway)\.mjs$/.test(file))
    return "tooling";
  if (repo === "supabase" && file.startsWith("supabase/migrations/"))
    return "database-history";
  if (repo === "supabase" && file.startsWith("supabase/rollbacks/"))
    return "database-history";
  if (repo === "web" && /^(scripts|tests|config)\//.test(file))
    return "verification";
  if (repo === "supabase" && /^(scripts\/|supabase\/tests\/)/.test(file))
    return "verification";
  if (
    /scripts\/learning|package\.json|config\.toml|restore-local-seed|\.config\.|tsconfig/.test(
      file,
    )
  )
    return "tooling";
  if (/supabase\/functions\/_shared/.test(file)) return "operations";
  if (
    /user-media|user_media|profile-change|profile-operation|user-profile|user-self|user-privacy|dashboard-shared-my|account-switcher|\[workspace\]\/my/.test(
      file,
    )
  )
    return "profile";
  if (
    /supabase\/functions\/exchange-rate|exchange-rate|company-exchange|\[workspace\]\/settings/.test(
      file,
    )
  )
    return "exchange-rates";
  if (/supabase\/functions\/sales-lead|sales-lead/.test(file))
    return "sales-leads";
  if (/logistics/.test(file)) return "logistics";
  if (/settlement-release|settlement_releases/.test(file)) return "settlements";
  if (/customer-inventory/.test(file)) return "inventory";
  if (/wholesale.*commission/.test(file)) return "wholesale-commission";
  // VIP验收夹具与开通弹窗同属VIP，不应因wholesale前缀落入普通订单模块。
  if (/business-vip|wholesale-vip|vip-memberships/.test(file)) return "vip";
  if (
    /wholesale.*(people|customers|profiles|referrals)|business-referrals|sales-staff-roles|salesman-business-access|client-business-access/.test(
      file,
    )
  )
    return "wholesale-people";
  if (
    /wholesale|order-date-range|order-list/.test(file) &&
    !/workspace-wholesale/.test(file)
  )
    return "wholesale-orders";
  if (/business-settings|business-parameter|commission-settings/.test(file))
    return "business-settings";
  if (/company-expenses|operator-reimbursement/.test(file)) return "expenses";
  if (
    /document-library|document-cleanup|document_library|document-explorer/.test(
      file,
    )
  )
    return "documents";
  if (/company-template|templates\/|examples\//.test(file)) return "templates";
  if (/ai-assistant|assistant-(chat|event)-stream/.test(file)) return "assistant";
  if (/mail|emailconnect|email-reminders/.test(file)) return "mail";
  if (/admin-review|review-center/.test(file)) return "reviews";
  // 同时识别模块目录和以单条公告命名的写入文件、业务测试。
  if (/announcement/.test(file)) return "announcements";
  if (/dashboard-home|\[workspace\]\/home/.test(file)) return "home";
  if (
    /admin-people|admin-account-receipts|salesman-people|person-private|person-notes|\[workspace\]\/accounts/.test(
      file,
    )
  )
    return "accounts";
  if (/admin-orders|service-fee|service-order/.test(file))
    return "tourism-orders";
  if (
    /task|team-management|tourism-people|components\/dashboard\/commission|lib\/(admin-commission|salesman-commission|commission-settlement|referrals)/.test(
      file,
    )
  )
    return "tourism-collaboration";
  if (/^messages\/|^i18n\/|lib\/(locale|i18n)/.test(file))
    return "localization";
  if (/components\/(ui|motion|brand)|app\/.*\.css$|motion-tokens/.test(file))
    return "design-system";
  if (
    /auth|login|register|forgot-password|current-session|current-app|verified-session|supabase/.test(
      file,
    )
  )
    return "auth";
  if (/legal|help-center|components\/legal/.test(file)) return "public-content";
  if (/^app\/|workspace|admin-shell/.test(file)) return "workspace";
  if (
    /operation|receipt|verified-action|mutation-receipts|upload-file-size/.test(
      file,
    )
  )
    return "operations";
  return "shared-utilities";
}
