/**
 * 信息层级规则独立于通用样式规则维护，避免主检查脚本继续承担新的职责。
 * 这里接收主脚本已经解析好的 JSX 信息，不重复读取文件，也不会修改任何源码。
 */
const SINGLE_CONTENT_LIST_FILES = new Set([
  "components/dashboard/admin-operation-records/admin-operation-records-sections.tsx",
  "components/dashboard/admin-tasks/admin-task-media-library-section.tsx",
  "components/dashboard/admin-tasks/admin-task-review-section.tsx",
  "components/dashboard/admin-tasks/admin-tasks-sections.tsx",
  "components/dashboard/commission/admin-task-commission-section.tsx",
  "components/dashboard/commission/salesman-commission-records-section.tsx",
  "components/dashboard/commission/salesman-task-commission-section.tsx",
  "components/dashboard/company-expenses/company-expenses-list.tsx",
  "components/dashboard/operator-reimbursements/operator-reimbursements-list.tsx",
  "components/dashboard/referrals/referrals-tree-view.tsx",
  "components/dashboard/salesman-people/salesman-people-sections.tsx",
  "components/dashboard/salesman-tasks/salesman-tasks-client.tsx",
  "components/dashboard/tourism-people/tourism-customers-client.tsx",
  "components/dashboard/tourism-people/tourism-people-client.tsx",
  "components/dashboard/wholesale/wholesale-commission-section.tsx",
  "components/dashboard/wholesale/wholesale-people-tabs.tsx",
  "components/dashboard/wholesale/wholesale-referral-commission-section.tsx",
  "components/dashboard/wholesale/wholesale-referrals-section.tsx",
  "components/dashboard/wholesale/wholesale-settlement-release-section.tsx",
]);

export function collectInformationHierarchyViolations({
  jsxElements,
  relativePath,
}) {
  const violations = [];

  for (const element of jsxElements) {
    if (element.tagName === "DashboardSectionHeader") {
      if (!/\bpresentation=/.test(element.attributesText)) {
        violations.push(
          `${relativePath}:${element.line}: DashboardSectionHeader 必须明确选择 work 或 overview，避免工作页重新出现大页头。`,
        );
      }

      const isWorkHeader = /\bpresentation=["']work["']/.test(
        element.attributesText,
      );
      const forbiddenWorkHeaderProperty = element.attributesText.match(
        /\b(badge|badgeIcon|description|metrics|asideFooter)=/,
      );
      if (isWorkHeader && forbiddenWorkHeaderProperty) {
        violations.push(
          `${relativePath}:${element.line}: 工作页头不能使用 ${forbiddenWorkHeaderProperty[1]}；请把业务状态或指标移到紧邻内容区。`,
        );
      }
    }

    if (element.tagName === "DashboardOrderListSection") {
      if (!/\bariaLabel=/.test(element.attributesText)) {
        violations.push(
          `${relativePath}:${element.line}: 订单列表必须通过 ariaLabel 提供无障碍区域名称。`,
        );
      }

      if (/\btitle=/.test(element.attributesText)) {
        violations.push(
          `${relativePath}:${element.line}: 页面标题已经说明订单类型，订单列表不能再显示重复板块标题。`,
        );
      }

      if (/\bdescription=/.test(element.attributesText)) {
        violations.push(
          `${relativePath}:${element.line}: 订单列表不再接受通用介绍文案；请把真实业务规则放到对应操作附近。`,
        );
      }
    }

    const repeatsSingleContentTitle =
      (element.tagName === "DashboardListSection" ||
        element.tagName === "DashboardCollectionSection") &&
      /\btitle=/.test(element.attributesText) &&
      (SINGLE_CONTENT_LIST_FILES.has(relativePath) ||
        (relativePath ===
          "components/dashboard/business-vip/business-vip-sections.tsx" &&
          /\btitle\s*=\s*\{\s*t\(["']directory\.title["']\)\s*\}/.test(
            element.attributesText,
          )));

    if (repeatsSingleContentTitle) {
      violations.push(
        `${relativePath}:${element.line}: 单一主内容区不能重复显示页面或标签页已经说明的板块标题；请改用 ariaLabel。`,
      );
    }
  }

  return violations;
}
