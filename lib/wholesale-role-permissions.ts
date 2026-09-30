import type { AppRole } from "./auth-routing";

/**
 * 批发业务的角色能力必须集中维护。
 *
 * 初学者容易把“页面能打开”“能修改业务数据”“拥有管理员权限”混在一起。
 * 这里把三类能力拆成明确的布尔值，页面只读取能力，不再自行拼接角色判断；
 * 数据库仍会执行最终权限校验，避免用户绕过页面按钮直接调用接口。
 */
export type WholesaleRoleCapabilities = {
  canAllocateSettlementRelease: boolean;
  canAssignSalesUser: boolean;
  canManageEveryCustomer: boolean;
  canManageEveryOrder: boolean;
  canManageInventoryCredit: boolean;
  canManageInventoryOrders: boolean;
  canManageLogistics: boolean;
  canPublishSettlementRelease: boolean;
  canReadFullBackoffice: boolean;
  canReadFullDirectory: boolean;
  canSettleCommission: boolean;
  usesPersonalCommissionScope: boolean;
  usesWholesaleSalesScope: boolean;
};

export function getWholesaleRoleCapabilities(
  role: AppRole | null,
): WholesaleRoleCapabilities {
  const isAdministrator = role === "administrator";
  const isWholesaleCollaborator =
    role === "salesman" || role === "finance";

  return {
    canAllocateSettlementRelease:
      isAdministrator || isWholesaleCollaborator,
    canAssignSalesUser: isAdministrator || isWholesaleCollaborator,
    canManageEveryCustomer: isAdministrator || isWholesaleCollaborator,
    canManageEveryOrder: isAdministrator || isWholesaleCollaborator,
    canManageInventoryCredit: isAdministrator || isWholesaleCollaborator,
    canManageInventoryOrders: isAdministrator || isWholesaleCollaborator,
    canManageLogistics: isAdministrator || isWholesaleCollaborator,
    canPublishSettlementRelease:
      isAdministrator || role === "finance",
    canReadFullBackoffice:
      isAdministrator || role === "manager" || role === "operator",
    canReadFullDirectory:
      isAdministrator ||
      role === "manager" ||
      role === "operator" ||
      role === "recruiter" ||
      isWholesaleCollaborator,
    canSettleCommission: isAdministrator,
    // 财务和业务员都能协作处理全部业务数据，但佣金仍只展示本人收益。
    usesPersonalCommissionScope: isWholesaleCollaborator,
    usesWholesaleSalesScope: isWholesaleCollaborator,
  };
}

/** 财务与业务员共同承担批发日常协作，但不会获得管理员专属能力。 */
export function canCollaborateAcrossWholesale(role: AppRole | null) {
  return getWholesaleRoleCapabilities(role).usesWholesaleSalesScope;
}

/** 批发客户、推荐关系和人员名称的完整读取范围。 */
export function canReadFullWholesaleDirectory(role: AppRole | null) {
  return getWholesaleRoleCapabilities(role).canReadFullDirectory;
}

/** 批发后台统计的完整读取范围，不包含仍需保持个人范围的业务员佣金。 */
export function canReadFullWholesaleBackoffice(role: AppRole | null) {
  return getWholesaleRoleCapabilities(role).canReadFullBackoffice;
}

/** 财务与业务员都采用批发协作查询范围。 */
export function canUseWholesaleSalesScope(role: AppRole | null) {
  return getWholesaleRoleCapabilities(role).usesWholesaleSalesScope;
}

/** 管理员、财务和业务员都能处理任意业务员名下的客户。 */
export function canManageEveryWholesaleCustomer(role: AppRole | null) {
  return getWholesaleRoleCapabilities(role).canManageEveryCustomer;
}

/** 管理员、财务和业务员都能处理任意业务员名下的订单。 */
export function canManageEveryWholesaleOrder(role: AppRole | null) {
  return getWholesaleRoleCapabilities(role).canManageEveryOrder;
}

/** 管理员、财务和业务员可以在全部批发业务员之间转派客户或订单。 */
export function canAssignWholesaleSalesUser(role: AppRole | null) {
  return getWholesaleRoleCapabilities(role).canAssignSalesUser;
}
