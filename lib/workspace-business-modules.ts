import { companyConfig } from "./company-config";
import type { CommissionRuleCode } from "./commission-settings";
import type { WorkspaceRouteSegment } from "./workspace-route-segments";
import type { WorkspaceSectionKey } from "./workspace-sections";
import { tourismWorkspaceBusinessModule } from "./workspace-tourism-module";
import { wholesaleWorkspaceBusinessModule } from "./workspace-wholesale-module";

export const registeredWorkspaceBusinessKeys = ["tourism", "wholesale"] as const;

export type WorkspaceBusinessKey =
  (typeof registeredWorkspaceBusinessKeys)[number];
export type EnabledWorkspaceBusinessKey = Extract<
  WorkspaceBusinessKey,
  (typeof companyConfig.enabledBusinessKeys)[number]
>;

export const workspaceWholesaleSectionKeys = [
  "orders",
  "inventory-orders",
  "settlement-releases",
  "order-claims",
  "leads",
  "logistics",
  "customers",
  "people",
  "referrals",
  "commission",
  "incentives",
  "vip",
  "settings",
] as const;

export type WorkspaceWholesaleSectionKey =
  (typeof workspaceWholesaleSectionKeys)[number];

export type WorkspaceGlobalNavSegment =
  | "accounts"
  | "announcements"
  | "company-templates"
  | "company-expenses"
  | "feedback"
  | "home"
  | "mail"
  | "my"
  | "reimbursements"
  | "reviews"
  | "settings"
  | "system-health";

export type WorkspaceNavSegment =
  | WorkspaceGlobalNavSegment
  | WorkspaceSectionKey
  | WorkspaceWholesaleSectionKey;

export type WorkspaceNavLabelKey =
  | "accounts"
  | "announcements"
  | "companyTemplates"
  | "companyExpenses"
  | "home"
  | "mail"
  | "my"
  | "orders"
  | "customers"
  | "people"
  | "records"
  | "reimbursements"
  | "referrals"
  | "businessSettings"
  | "team"
  | "commission"
  | "exchangeRates"
  | "feedback"
  | "tasks"
  | "vip"
  | "reviews"
  | "settings"
  | "systemHealth"
  | "incentives"
  | "settlementReleases"
  | "orderClaims"
  | "salesLeads"
  | "logistics"
  | "customerInventoryOrders"
  | "wholesaleOrders";

export type WorkspaceBusinessLabelKey = WorkspaceBusinessKey;

export type WorkspaceOrdersPageMode = "admin" | "salesman" | "client";
export type WorkspaceCommissionPageMode = "admin" | "salesman";
export type WorkspaceTasksPageMode = "admin" | "staff";
export type WorkspacePeoplePageMode = "admin" | "salesman";
export type WorkspaceCustomersPageMode = "admin" | "salesman";
export type WorkspaceVipPageMode = "admin" | "salesman";

export type WorkspaceBusinessPageVariants = {
  commission?: WorkspaceCommissionPageMode;
  customers?: WorkspaceCustomersPageMode;
  orders?: WorkspaceOrdersPageMode;
  people?: WorkspacePeoplePageMode;
  records?: true;
  referrals?: true;
  settings?: true;
  tasks?: WorkspaceTasksPageMode;
  team?: true;
  vip?: WorkspaceVipPageMode;
};

export type WorkspaceNavItem = {
  business?: WorkspaceBusinessKey;
  segment: WorkspaceNavSegment;
  labelKey: WorkspaceNavLabelKey;
};

export type WorkspaceNavGroup = {
  business: WorkspaceBusinessKey;
  labelKey: WorkspaceBusinessLabelKey;
  navItems: readonly WorkspaceNavItem[];
};

export type WorkspaceBusinessPageEntry = "tourism" | "wholesale";

export type WorkspaceBusinessSettingsSection =
  | { kind: "tourismServiceFees" }
  | { kind: "tourismServiceOrders" }
  | {
      kind: "commissionRules";
      ruleCodes: readonly CommissionRuleCode[];
    };

export type WorkspaceBusinessSettingsModule = {
  business: WorkspaceBusinessKey;
  descriptionKey: string;
  sections: readonly WorkspaceBusinessSettingsSection[];
  titleKey: string;
};

export type WorkspaceBusinessModule = {
  key: WorkspaceBusinessKey;
  labelKey: WorkspaceBusinessLabelKey;
  navItemsByRouteSegment: Partial<
    Record<WorkspaceRouteSegment, readonly WorkspaceNavItem[]>
  >;
  pageEntry: WorkspaceBusinessPageEntry;
  pageVariantsByRouteSegment: Partial<
    Record<WorkspaceRouteSegment, WorkspaceBusinessPageVariants>
  >;
  settings?: WorkspaceBusinessSettingsModule;
  wholesalePageVariantsByRouteSegment?: Partial<
    Record<
      WorkspaceRouteSegment,
      Partial<Record<WorkspaceWholesaleSectionKey, true>>
    >
  >;
};

const allWorkspaceBusinessModules: readonly WorkspaceBusinessModule[] = [
  tourismWorkspaceBusinessModule,
  wholesaleWorkspaceBusinessModule,
];

const registeredBusinessKeySet = new Set<string>(
  registeredWorkspaceBusinessKeys,
);
const enabledBusinessKeySet = new Set<string>(
  companyConfig.enabledBusinessKeys,
);

export const workspaceBusinessModules = allWorkspaceBusinessModules.filter(
  (module) => enabledBusinessKeySet.has(module.key),
);

export const enabledWorkspaceBusinessKeys = workspaceBusinessModules.map(
  (module) => module.key,
) as EnabledWorkspaceBusinessKey[];

export function isRegisteredWorkspaceBusinessKey(
  value: string,
): value is WorkspaceBusinessKey {
  return registeredBusinessKeySet.has(value);
}

export function isEnabledWorkspaceBusinessKey(
  value: string,
): value is EnabledWorkspaceBusinessKey {
  return enabledBusinessKeySet.has(value);
}

export function getWorkspaceBusinessModule(
  business: WorkspaceBusinessKey,
): WorkspaceBusinessModule | null {
  return (
    workspaceBusinessModules.find((module) => module.key === business) ?? null
  );
}

export function getWorkspaceBusinessNavGroups(
  routeSegment: WorkspaceRouteSegment,
): WorkspaceNavGroup[] {
  return workspaceBusinessModules
    .map((module) => {
      const navItems: readonly WorkspaceNavItem[] =
        module.navItemsByRouteSegment[routeSegment] ?? [];

      return {
        business: module.key,
        labelKey: module.labelKey,
        navItems: navItems.map((item) => ({
          ...item,
          business: item.business ?? module.key,
        })),
      };
    })
    .filter((group) => group.navItems.length > 0);
}

export function getWorkspaceBusinessPageVariants(
  routeSegment: WorkspaceRouteSegment,
): WorkspaceBusinessPageVariants {
  return workspaceBusinessModules.reduce<WorkspaceBusinessPageVariants>(
    (variants, module) => ({
      ...variants,
      ...(module.pageVariantsByRouteSegment[routeSegment] ?? {}),
    }),
    {},
  );
}

export function getWorkspaceWholesalePageVariants(
  routeSegment: WorkspaceRouteSegment,
): Partial<Record<WorkspaceWholesaleSectionKey, true>> | undefined {
  const wholesaleModule = getWorkspaceBusinessModule("wholesale");

  return wholesaleModule?.wholesalePageVariantsByRouteSegment?.[routeSegment];
}

export function getWorkspaceBusinessSettingsModules() {
  return workspaceBusinessModules
    .map((module) => module.settings)
    .filter((settings): settings is WorkspaceBusinessSettingsModule =>
      Boolean(settings),
    );
}

export function getWorkspaceBusinessSettingsModule(
  business: WorkspaceBusinessKey,
) {
  return getWorkspaceBusinessSettingsModules().find(
    (module) => module.business === business,
  );
}
