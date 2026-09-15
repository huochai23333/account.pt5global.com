import { getDefaultWorkspaceBasePath, type AppRole } from "@/lib/auth-routing";
import {
  getWorkspaceConfigByBasePath,
  getWorkspaceConfigForPathname,
  type WorkspaceBusinessKey,
  type WorkspaceNavItem,
  type WorkspaceNavLabelKey,
  type WorkspacePageVariants,
  type WorkspaceRouteConfig,
} from "@/lib/workspace-config";
import { getWorkspaceBusinessModule } from "@/lib/workspace-business-modules";
import { isSalesStaffRole } from "@/lib/sales-staff-roles";

const ROLE_LABELS = {
  administrator: "管理员",
  client: "客户",
  finance: "财务",
  manager: "经理",
  operator: "运营",
  promoter: "地推",
  recruiter: "招聘员",
  salesman: "业务员",
} as const satisfies Record<AppRole, string>;

const NAV_LABELS = {
  accounts: "账号管理",
  announcements: "公告管理",
  businessSettings: "业务设置",
  companyExpenses: "公司费用",
  commission: "佣金",
  customerInventoryOrders: "库存订单",
  customers: "客户管理",
  exchangeRates: "汇率",
  feedback: "反馈管理",
  home: "首页",
  incentives: "提成",
  logistics: "物流管理",
  my: "我的",
  orderClaims: "订单认领",
  salesLeads: "线索",
  orders: "订单",
  people: "人员管理",
  records: "操作记录",
  reimbursements: "报销记录",
  referrals: "推荐树",
  reviews: "审核",
  settlementReleases: "结汇发布",
  settings: "系统设置",
  systemHealth: "系统运行",
  tasks: "任务",
  team: "团队",
  vip: "VIP管理",
  wholesaleOrders: "批发订单",
} as const satisfies Record<WorkspaceNavLabelKey, string>;

const NAV_ENTRY_DESCRIPTIONS = {
  accounts: "管理系统登录账号、身份、状态和城市",
  announcements: "发布和管理系统公告",
  businessSettings: "维护当前业务内的价格、佣金和相关规则",
  companyExpenses: "按月份记录公司对外支出费用",
  commission: "查看或处理订单佣金与任务奖励",
  customerInventoryOrders:
    "查看客户库存采购订单、Order List、专属信贷、延期和还款",
  customers: "按当前业务查看和维护客户资料、客户标记或客户归属",
  exchangeRates: "查看币种汇率和历史记录；管理员还可以维护汇率和获取设置",
  feedback: "管理员查看和跟进用户反馈",
  home: "查看问候、公告和当前提醒",
  incentives: "查看批发业务员提成、待结算金额和结算状态",
  logistics: "查看店小秘物流永久档案、店铺历史归属、缺失运费和分币种运费汇总",
  my: "从头像进入个人资料、邀请码和账号入口",
  orderClaims: "接收 1688 采购订单并由业务员认领归属客户",
  salesLeads: "从大厅认领潜在客户、记录联系结果并在期限内持续跟进",
  orders: "查看或处理当前账号可见的订单",
  people: "按当前业务查看业务人员或承接账号资料",
  records: "查看重要处理动作的留痕",
  reimbursements: "记录运营自己的报销内容和金额，并按当前周期标记为已报销",
  referrals: "按当前可见业务板块查看推荐关系和邀请码线索",
  reviews: "处理资料和媒体审核",
  settlementReleases: "发布和认领批发客户结汇收款，并匹配到对应订单",
  settings: "查看汇率；管理员还可以维护汇率和获取设置",
  systemHealth: "查看后台任务实际完成时间、重试次数和需要处理的系统问题",
  tasks: "查看、领取、提交或管理任务",
  team: "查看当前账号可见的团队范围",
  vip: "在对应业务内处理VIP申请、收款确认、充值记录和有效期调整",
  wholesaleOrders: "管理批发客户订单、费用、毛利、订单月份和关联 1688 采购订单",
} as const satisfies Record<WorkspaceNavLabelKey, string>;

const BUSINESS_LABELS = {
  tourism: "旅游业务",
  wholesale: "批发业务",
} as const satisfies Record<WorkspaceBusinessKey, string>;

const SYSTEM_UPDATE_GUIDES = [
  "当前工作台开放批发业务，使用独立的客户、订单、1688 认领、物流、提成和推荐功能。",
  "任务支持按目标角色发放、多人分别领取、分别提交审核；管理员可以设置提交任务时是否必须上传文件。",
  "管理员可以通过操作记录核对重要处理动作，也可以通过反馈管理跟进用户提交的问题。",
  "个人照片上传后的图片初审只是辅助检查，是否通过以审核结果和页面提示为准。",
  "注册或邀请码遇到问题时，引导用户确认推荐人发送的完整邀请码、返回登录，或联系管理员查看，不要把它说成系统故障。",
] as const;

type AssistantWorkspaceContext = {
  currentPageGuide: string;
  roleGuide: string;
  roleLabel: string;
  systemGuide: string;
};

export function buildAssistantWorkspaceContext({
  pathname,
  role,
}: {
  pathname: string;
  role: AppRole | null;
}): AssistantWorkspaceContext {
  const roleConfig = getRoleWorkspaceConfig(role);
  const currentPageConfig = getWorkspaceConfigForPathname(pathname);
  const roleLabel = role ? ROLE_LABELS[role] : "未确认";

  return {
    currentPageGuide: buildCurrentPageGuide(pathname, currentPageConfig),
    roleGuide: roleConfig
      ? buildRoleGuide(roleConfig)
      : "当前账号角色暂未确认，只能回答通用工作台问题。",
    roleLabel,
    systemGuide: buildSystemGuide(roleConfig),
  };
}

function getRoleWorkspaceConfig(role: AppRole | null) {
  if (!role) {
    return null;
  }

  return getWorkspaceConfigByBasePath(getDefaultWorkspaceBasePath(role));
}

function buildRoleGuide(config: WorkspaceRouteConfig) {
  const entries = [
    ...config.globalNavItems.map((item) => buildNavEntryGuide(config, item)),
    ...config.navGroups.flatMap((group) =>
      group.navItems.map(
        (item) =>
          `${BUSINESS_LABELS[group.business]} / ${buildNavEntryGuide(config, item)}`,
      ),
    ),
  ];
  const profileEntry = `${NAV_LABELS.my}：${NAV_ENTRY_DESCRIPTIONS.my}`;

  return `${ROLE_LABELS[config.authRole]}可使用：${[...entries, profileEntry].join("；")}。`;
}

function buildNavEntryGuide(
  config: WorkspaceRouteConfig,
  item: WorkspaceNavItem,
) {
  return `${NAV_LABELS[item.labelKey]}：${getNavEntryDescription(config, item)}`;
}

function getNavEntryDescription(
  config: WorkspaceRouteConfig,
  item: WorkspaceNavItem,
) {
  if (isSalesStaffRole(config.authRole) && item.segment === "orders") {
    return isWholesaleBusinessNavItem(item)
      ? NAV_ENTRY_DESCRIPTIONS.wholesaleOrders
      : "按当前账号可见范围处理订单；如果页面没有该入口，以当前工作台实际显示为准";
  }

  if (isSalesStaffRole(config.authRole) && item.segment === "customers") {
    return "按当前账号可见业务范围查看客户；如果页面没有该入口，以当前工作台实际显示为准";
  }

  if (isSalesStaffRole(config.authRole) && item.segment === "people") {
    return "按当前账号可见业务范围查看业务人员或承接账号；如果页面没有该入口，以当前工作台实际显示为准";
  }

  return NAV_ENTRY_DESCRIPTIONS[item.labelKey];
}

function isWholesaleBusinessNavItem(item: WorkspaceNavItem) {
  if (!item.business) {
    return false;
  }

  return getWorkspaceBusinessModule(item.business)?.pageEntry === "wholesale";
}

function buildCurrentPageGuide(
  pathname: string,
  currentPageConfig: WorkspaceRouteConfig | null,
) {
  if (!pathname || pathname === "/") {
    return "当前页面未确认，回答时优先按当前角色可用入口引导。";
  }

  if (!currentPageConfig) {
    return "当前页面不属于工作台页面，不要据此推断业务数据。";
  }

  const section = pathname
    .replace(`${currentPageConfig.basePath}/`, "")
    .split("/")
    .filter(Boolean);
  const globalSection = section[0] ?? "";
  const business = section[0] ?? "";
  const businessSection = section[1] ?? "";
  const navItem = findWorkspaceNavItem(
    currentPageConfig,
    business,
    businessSection,
  );
  const globalNavItem = currentPageConfig.globalNavItems.find(
    (item) => item.segment === globalSection,
  );

  if (globalSection === "my") {
    return `${ROLE_LABELS[currentPageConfig.authRole]}当前在“我的”页面，只能说明个人资料、邀请码和账号入口相关操作。`;
  }

  if (globalNavItem) {
    return `${ROLE_LABELS[currentPageConfig.authRole]}当前在“${NAV_LABELS[globalNavItem.labelKey]}”页面，主要用途是${getNavEntryDescription(currentPageConfig, globalNavItem)}。`;
  }

  if (!navItem) {
    return `${ROLE_LABELS[currentPageConfig.authRole]}当前页面没有明确匹配到左侧入口，不要据此扩展功能。`;
  }

  const description = getNavEntryDescription(currentPageConfig, navItem);

  return `${ROLE_LABELS[currentPageConfig.authRole]}当前在“${NAV_LABELS[navItem.labelKey]}”页面，主要用途是${description}。`;
}

function findWorkspaceNavItem(
  config: WorkspaceRouteConfig,
  business: string,
  section: string,
) {
  return config.navGroups
    .find((group) => group.business === business)
    ?.navItems.find((item) => item.segment === section);
}

function buildSystemGuide(config: WorkspaceRouteConfig | null) {
  const pageVariantGuide = config
    ? buildPageVariantGuide(config.pageVariants)
    : "角色未确认时，不要承诺任何专属入口。";

  return [pageVariantGuide, ...SYSTEM_UPDATE_GUIDES].join("\n- ");
}

function buildPageVariantGuide(pageVariants: WorkspacePageVariants) {
  const roleNotes = [
    pageVariants.orders ? getOrdersGuide(pageVariants.orders) : null,
    pageVariants.customers ? getCustomersGuide(pageVariants.customers) : null,
    pageVariants.people ? getPeopleGuide(pageVariants.people) : null,
    pageVariants.vip ? getVipGuide(pageVariants.vip) : null,
    pageVariants.tasks ? getTasksGuide(pageVariants.tasks) : null,
    pageVariants.commission
      ? getCommissionGuide(pageVariants.commission)
      : null,
    pageVariants.settings
      ? "业务设置在对应业务侧栏内维护；外侧汇率页供内部账号查看，只有管理员可以维护和获取汇率。"
      : null,
    pageVariants.feedback ? "反馈管理只用于管理员查看和处理用户反馈。" : null,
    pageVariants.operatorReimbursements
      ? "报销记录只用于运营记录自己的报销内容和金额，并把当前周期未报销记录标记为已报销。"
      : null,
    pageVariants.records ? "操作记录只用于管理员核对重要处理动作。" : null,
    pageVariants.reviews ? "审核中心由管理员处理资料和媒体审核。" : null,
  ].filter(Boolean);

  if (roleNotes.length === 0) {
    return "当前角色只开放基础工作台入口，回答时不要扩展管理员或内部处理能力。";
  }

  return roleNotes.join(" ");
}

function getOrdersGuide(mode: WorkspacePageVariants["orders"]) {
  if (mode === "admin") {
    return "管理员订单页用于订单处理，汇率在汇率设置中维护。";
  }

  if (mode === "salesman") {
    return "业务员订单页按当前账号可见业务范围展示订单。";
  }

  return "客户订单页用于查看自己的订单。";
}

function getPeopleGuide(mode: WorkspacePageVariants["people"]) {
  if (mode === "admin") {
    return "管理员人员管理用于查看业务人员；账号身份、状态和城市在全局账号管理中调整。";
  }

  return "人员入口按当前账号的业务范围展示业务人员或承接账号。";
}

function getCustomersGuide(mode: WorkspacePageVariants["customers"]) {
  if (mode === "admin") {
    return "管理员客户管理用于维护当前开放业务的客户资料。";
  }

  return "业务员或地推客户管理用于查看自己可跟进的客户，客户资料不再放在人员管理里。";
}

function getVipGuide(mode: WorkspacePageVariants["vip"]) {
  if (mode === "admin") {
    return "管理员VIP管理用于处理批发客户的开通、续费和操作记录；不要再引导到账号管理里处理VIP。";
  }

  return "业务员VIP管理用于查看批发客户VIP状态，并直接开通、续费和查看操作记录。";
}

function getTasksGuide(mode: WorkspacePageVariants["tasks"]) {
  if (mode === "admin") {
    return "管理员任务页用于发布、分派、查看领取进度、处理任务详情和任务审核。";
  }

  return "内部成员任务页用于查看可见任务、领取任务、提交成果并等待审核。";
}

function getCommissionGuide(mode: WorkspacePageVariants["commission"]) {
  if (mode === "admin") {
    return "管理员佣金页用于复核和处理订单佣金与任务奖励。";
  }

  return "业务员佣金页用于查看自己的订单佣金和任务奖励。";
}
