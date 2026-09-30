import type {
  WorkspaceBusinessModule,
  WorkspaceNavItem,
  WorkspaceNavLabelKey,
  WorkspaceWholesaleSectionKey,
} from "./workspace-business-modules";

// 管理员和业务员按“线索 → 客户 → 订单”的业务过程排列；桌面与手机共用此顺序。
const adminNavItems = createNavItems([
  ["leads", "salesLeads"],
  ["customers", "customers"],
  ["orders", "wholesaleOrders"],
  ["inventory-orders", "customerInventoryOrders"],
  ["settlement-releases", "settlementReleases"],
  ["logistics", "logistics"],
  ["people", "people"],
  ["vip", "vip"],
  ["referrals", "referrals"],
  ["commission", "commission"],
  ["incentives", "incentives"],
  ["settings", "businessSettings"],
]);
const salesNavItems = createNavItems([
  ["orders", "wholesaleOrders"],
  ["customers", "customers"],
  ["people", "people"],
  ["vip", "vip"],
  ["referrals", "referrals"],
  ["commission", "commission"],
  ["incentives", "incentives"],
]);
const salesmanNavItems = createNavItems([
  ["leads", "salesLeads"],
  ["customers", "customers"],
  ["orders", "wholesaleOrders"],
  ["inventory-orders", "customerInventoryOrders"],
  ["settlement-releases", "settlementReleases"],
  ["logistics", "logistics"],
  ["vip", "vip"],
  ["referrals", "referrals"],
  ["commission", "commission"],
  ["incentives", "incentives"],
]);
const clientNavItems = createNavItems([
  ["orders", "wholesaleOrders"],
  ["inventory-orders", "customerInventoryOrders"],
  ["referrals", "referrals"],
  ["commission", "commission"],
]);
const managerNavItems = createNavItems([
  ["orders", "wholesaleOrders"],
  ["referrals", "referrals"],
  ["commission", "commission"],
  ["incentives", "incentives"],
]);
const operatorNavItems = createNavItems([["orders", "wholesaleOrders"]]);
const recruiterNavItems = createNavItems([["referrals", "referrals"]]);

// 财务继续参与订单、物流等日常协作，但客户联系方式和联系历史只向业务员开放。
const financeNavItems = createNavItems([
  ["orders", "wholesaleOrders"],
  ["inventory-orders", "customerInventoryOrders"],
  ["settlement-releases", "settlementReleases"],
  ["logistics", "logistics"],
  ["customers", "customers"],
  ["vip", "vip"],
  ["referrals", "referrals"],
  ["commission", "commission"],
  ["incentives", "incentives"],
]);

export const wholesaleWorkspaceBusinessModule: WorkspaceBusinessModule = {
  key: "wholesale",
  labelKey: "wholesale",
  navItemsByRouteSegment: {
    admin: adminNavItems,
    client: clientNavItems,
    finance: financeNavItems,
    manager: managerNavItems,
    operator: operatorNavItems,
    promoter: salesNavItems,
    recruiter: recruiterNavItems,
    salesman: salesmanNavItems,
  },
  pageEntry: "wholesale",
  pageVariantsByRouteSegment: {},
  settings: {
    business: "wholesale",
    descriptionKey: "tabs.wholesale.description",
    sections: [
      {
        kind: "commissionRules",
        ruleCodes: [
          "wholesale_order_salesman_tier",
          "wholesale_referral_order_amount_rate",
          "wholesale_referral_waybill_bonus",
        ],
      },
    ],
    titleKey: "tabs.wholesale.title",
  },
  wholesalePageVariantsByRouteSegment: {
    admin: createPageVariants(adminNavItems),
    client: createPageVariants(clientNavItems),
    finance: createPageVariants(financeNavItems),
    manager: createPageVariants(managerNavItems),
    operator: createPageVariants(operatorNavItems),
    promoter: createPageVariants(salesNavItems),
    recruiter: createPageVariants(recruiterNavItems),
    salesman: createPageVariants(salesmanNavItems),
  },
};

function createNavItems(
  entries: readonly [WorkspaceWholesaleSectionKey, WorkspaceNavLabelKey][],
) {
  return entries.map(([segment, labelKey]) => ({
    business: "wholesale" as const,
    labelKey,
    segment,
  })) satisfies WorkspaceNavItem[];
}

function createPageVariants(
  navItems: readonly WorkspaceNavItem[],
): Partial<Record<WorkspaceWholesaleSectionKey, true>> {
  return Object.fromEntries(
    navItems.map((item) => [item.segment, true]),
  ) as Partial<Record<WorkspaceWholesaleSectionKey, true>>;
}
