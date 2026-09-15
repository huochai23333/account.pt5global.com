import {
  getWorkspaceBasePath,
  type AppRole,
  type WorkspaceBasePath,
} from "./auth-routing";
import {
  getWorkspaceBusinessNavGroups,
  getWorkspaceBusinessPageVariants,
  getWorkspaceWholesalePageVariants,
  enabledWorkspaceBusinessKeys,
  isEnabledWorkspaceBusinessKey,
  isRegisteredWorkspaceBusinessKey,
  registeredWorkspaceBusinessKeys,
  workspaceWholesaleSectionKeys,
  type EnabledWorkspaceBusinessKey,
  type WorkspaceBusinessKey,
  type WorkspaceBusinessLabelKey,
  type WorkspaceBusinessPageVariants,
  type WorkspaceGlobalNavSegment,
  type WorkspaceNavGroup,
  type WorkspaceNavItem,
  type WorkspaceNavLabelKey,
  type WorkspaceNavSegment,
  type WorkspaceWholesaleSectionKey,
} from "./workspace-business-modules";
import {
  workspaceRouteSegments,
  type WorkspaceLoadingTitleKey,
  type WorkspaceRouteSegment,
} from "./workspace-route-segments";

export {
  enabledWorkspaceBusinessKeys,
  isEnabledWorkspaceBusinessKey,
  isRegisteredWorkspaceBusinessKey,
  registeredWorkspaceBusinessKeys,
  workspaceRouteSegments,
  workspaceWholesaleSectionKeys,
};
export type {
  EnabledWorkspaceBusinessKey,
  WorkspaceBusinessKey,
  WorkspaceBusinessLabelKey,
  WorkspaceGlobalNavSegment,
  WorkspaceLoadingTitleKey,
  WorkspaceNavGroup,
  WorkspaceNavItem,
  WorkspaceNavLabelKey,
  WorkspaceNavSegment,
  WorkspaceRouteSegment,
  WorkspaceWholesaleSectionKey,
};

export type WorkspacePageVariants = WorkspaceBusinessPageVariants & {
  accounts?: true;
  announcements?: true;
  companyExpenses?: true;
  feedback?: true;
  operatorReimbursements?: true;
  reviews?: true;
  settings?: true;
  systemHealth?: true;
};

export type WorkspaceRouteConfig = {
  authRole: AppRole;
  basePath: WorkspaceBasePath;
  globalNavItems: readonly WorkspaceNavItem[];
  initials: string;
  navGroups: readonly WorkspaceNavGroup[];
  pageVariants: WorkspacePageVariants;
  routeSegment: WorkspaceRouteSegment;
  wholesalePageVariants?: Partial<Record<WorkspaceWholesaleSectionKey, true>>;
};

const homeNavItems = [
  { segment: "home", labelKey: "home" },
] as const satisfies readonly WorkspaceNavItem[];

const internalGlobalNavItems = [
  { segment: "home", labelKey: "home" },
  { segment: "settings", labelKey: "exchangeRates" },
] as const satisfies readonly WorkspaceNavItem[];

const adminGlobalNavItems = [
  { segment: "home", labelKey: "home" },
  { segment: "reviews", labelKey: "reviews" },
  { segment: "accounts", labelKey: "accounts" },
  { segment: "announcements", labelKey: "announcements" },
  { segment: "company-expenses", labelKey: "companyExpenses" },
  { segment: "feedback", labelKey: "feedback" },
  { segment: "settings", labelKey: "exchangeRates" },
  { segment: "system-health", labelKey: "systemHealth" },
] as const satisfies readonly WorkspaceNavItem[];

const financeGlobalNavItems = [
  { segment: "home", labelKey: "home" },
  { segment: "company-expenses", labelKey: "companyExpenses" },
  { segment: "settings", labelKey: "exchangeRates" },
] as const satisfies readonly WorkspaceNavItem[];

const operatorGlobalNavItems = [
  { segment: "home", labelKey: "home" },
  { segment: "reimbursements", labelKey: "reimbursements" },
  { segment: "settings", labelKey: "exchangeRates" },
] as const satisfies readonly WorkspaceNavItem[];

function createWorkspaceRouteConfig({
  authRole,
  basePath,
  globalNavItems = homeNavItems,
  initials,
  routeSegment,
  globalPageVariants = {},
}: {
  authRole: AppRole;
  basePath: WorkspaceBasePath;
  globalNavItems?: readonly WorkspaceNavItem[];
  globalPageVariants?: Pick<
    WorkspacePageVariants,
    | "accounts"
    | "announcements"
    | "companyExpenses"
    | "feedback"
    | "operatorReimbursements"
    | "reviews"
    | "settings"
    | "systemHealth"
  >;
  initials: string;
  routeSegment: WorkspaceRouteSegment;
}): WorkspaceRouteConfig {
  return {
    authRole,
    basePath,
    globalNavItems,
    initials,
    navGroups: getWorkspaceBusinessNavGroups(routeSegment),
    pageVariants: {
      ...globalPageVariants,
      ...getWorkspaceBusinessPageVariants(routeSegment),
    },
    routeSegment,
    wholesalePageVariants: getWorkspaceWholesalePageVariants(routeSegment),
  };
}

const WORKSPACE_ROUTE_CONFIG_BY_SEGMENT = {
  admin: createWorkspaceRouteConfig({
    authRole: "administrator",
    basePath: "/admin",
    globalNavItems: adminGlobalNavItems,
    globalPageVariants: {
      accounts: true,
      announcements: true,
      companyExpenses: true,
      feedback: true,
      reviews: true,
      settings: true,
      systemHealth: true,
    },
    initials: "AD",
    routeSegment: "admin",
  }),
  client: createWorkspaceRouteConfig({
    authRole: "client",
    basePath: "/client",
    initials: "CL",
    routeSegment: "client",
  }),
  finance: createWorkspaceRouteConfig({
    authRole: "finance",
    basePath: "/finance",
    globalNavItems: financeGlobalNavItems,
    globalPageVariants: {
      companyExpenses: true,
      settings: true,
    },
    initials: "FN",
    routeSegment: "finance",
  }),
  manager: createWorkspaceRouteConfig({
    authRole: "manager",
    basePath: "/manager",
    globalNavItems: internalGlobalNavItems,
    globalPageVariants: {
      settings: true,
    },
    initials: "MG",
    routeSegment: "manager",
  }),
  operator: createWorkspaceRouteConfig({
    authRole: "operator",
    basePath: "/operator",
    globalNavItems: operatorGlobalNavItems,
    globalPageVariants: {
      operatorReimbursements: true,
      settings: true,
    },
    initials: "OP",
    routeSegment: "operator",
  }),
  recruiter: createWorkspaceRouteConfig({
    authRole: "recruiter",
    basePath: "/recruiter",
    globalNavItems: internalGlobalNavItems,
    globalPageVariants: {
      settings: true,
    },
    initials: "RC",
    routeSegment: "recruiter",
  }),
  salesman: createWorkspaceRouteConfig({
    authRole: "salesman",
    basePath: "/salesman",
    globalNavItems: internalGlobalNavItems,
    globalPageVariants: {
      settings: true,
    },
    initials: "YW",
    routeSegment: "salesman",
  }),
  promoter: createWorkspaceRouteConfig({
    authRole: "promoter",
    basePath: "/promoter",
    globalNavItems: internalGlobalNavItems,
    globalPageVariants: {
      settings: true,
    },
    initials: "DT",
    routeSegment: "promoter",
  }),
} as const satisfies Record<WorkspaceRouteSegment, WorkspaceRouteConfig>;

const WORKSPACE_ROUTE_CONFIG_BY_BASE_PATH = {
  "/admin": WORKSPACE_ROUTE_CONFIG_BY_SEGMENT.admin,
  "/client": WORKSPACE_ROUTE_CONFIG_BY_SEGMENT.client,
  "/finance": WORKSPACE_ROUTE_CONFIG_BY_SEGMENT.finance,
  "/manager": WORKSPACE_ROUTE_CONFIG_BY_SEGMENT.manager,
  "/operator": WORKSPACE_ROUTE_CONFIG_BY_SEGMENT.operator,
  "/promoter": WORKSPACE_ROUTE_CONFIG_BY_SEGMENT.promoter,
  "/recruiter": WORKSPACE_ROUTE_CONFIG_BY_SEGMENT.recruiter,
  "/salesman": WORKSPACE_ROUTE_CONFIG_BY_SEGMENT.salesman,
} as const satisfies Record<WorkspaceBasePath, WorkspaceRouteConfig>;

const workspaceRouteSegmentSet = new Set<string>(workspaceRouteSegments);
const workspaceWholesaleSectionKeySet = new Set<string>(workspaceWholesaleSectionKeys);
const workspaceGlobalNavSegmentSet = new Set<string>([
  "accounts",
  "announcements",
  "company-expenses",
  "feedback",
  "home",
  "my",
  "reimbursements",
  "reviews",
  "settings",
  "system-health",
]);

export function isWorkspaceRouteSegment(value: string): value is WorkspaceRouteSegment {
  return workspaceRouteSegmentSet.has(value);
}

export function isWorkspaceWholesaleSectionKey(
  value: string,
): value is WorkspaceWholesaleSectionKey {
  return workspaceWholesaleSectionKeySet.has(value);
}

export function isWorkspaceGlobalNavSegment(
  value: string,
): value is WorkspaceGlobalNavSegment {
  return workspaceGlobalNavSegmentSet.has(value);
}

export function getWorkspaceConfigByRouteSegment(
  value: string,
): WorkspaceRouteConfig | null {
  if (!isWorkspaceRouteSegment(value)) {
    return null;
  }

  return WORKSPACE_ROUTE_CONFIG_BY_SEGMENT[value];
}

export function getWorkspaceConfigByBasePath(
  basePath: string | null,
): WorkspaceRouteConfig | null {
  if (!basePath) {
    return null;
  }

  return WORKSPACE_ROUTE_CONFIG_BY_BASE_PATH[basePath as WorkspaceBasePath] ?? null;
}

export function getWorkspaceConfigForPathname(pathname: string) {
  return getWorkspaceConfigByBasePath(getWorkspaceBasePath(pathname));
}

export function getWorkspaceNavHref(
  configOrSegment: WorkspaceRouteConfig | WorkspaceRouteSegment,
  segment: WorkspaceNavSegment,
) {
  const config =
    typeof configOrSegment === "string"
      ? WORKSPACE_ROUTE_CONFIG_BY_SEGMENT[configOrSegment]
      : configOrSegment;

  if (isWorkspaceGlobalNavSegment(segment)) {
    return `${config.basePath}/${segment}`;
  }

  const defaultBusiness = enabledWorkspaceBusinessKeys[0];

  if (!defaultBusiness) {
    throw new Error("workspace_business_unavailable");
  }

  return getWorkspaceBusinessNavHref(config, defaultBusiness, segment);
}

export function getWorkspaceBusinessNavHref(
  configOrSegment: WorkspaceRouteConfig | WorkspaceRouteSegment,
  business: WorkspaceBusinessKey,
  segment: WorkspaceNavSegment,
) {
  const config =
    typeof configOrSegment === "string"
      ? WORKSPACE_ROUTE_CONFIG_BY_SEGMENT[configOrSegment]
      : configOrSegment;

  return `${config.basePath}/${business}/${segment}`;
}

export function getWorkspaceHomeHref(
  configOrSegment: WorkspaceRouteConfig | WorkspaceRouteSegment,
) {
  return getWorkspaceNavHref(configOrSegment, "home");
}
