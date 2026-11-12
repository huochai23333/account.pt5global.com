import type { AppRole } from "./auth-routing";
import type {
  WholesaleCommission,
  WholesaleOrderChangeLog,
  WholesaleOrderSettlement,
} from "./wholesale-types";
import {
  canCollaborateAcrossWholesale,
  canReadFullWholesaleBackoffice,
} from "./wholesale-role-permissions";

// 提成与订单明细使用各自的可见范围，共用已经授权的客户和订单编号。
export function scopeWholesaleCommissions({
  currentRole,
  currentUserId,
  commissions,
  customerIds,
  orderIds,
}: {
  currentRole: AppRole | null;
  currentUserId: string | null;
  commissions: WholesaleCommission[];
  customerIds: Set<string>;
  orderIds: Set<string>;
}) {
  if (canReadFullWholesaleBackoffice(currentRole)) return commissions;
  if (!currentUserId) return [];

  if (canCollaborateAcrossWholesale(currentRole)) {
    // 财务和业务员可以协作处理日常订单，但佣金仍只展示给实际受益人本人。
    return commissions.filter(
      (commission) => commission.beneficiary_user_id === currentUserId,
    );
  }

  return commissions.filter(
    (commission) =>
      (commission.customer_id
        ? customerIds.has(commission.customer_id)
        : false) ||
      orderIds.has(commission.order_id) ||
      commission.beneficiary_user_id === currentUserId ||
      commission.settled_by_user_id === currentUserId,
  );
}

export function scopeWholesaleOrderChangeLogs({
  currentRole,
  currentUserId,
  orderChangeLogs,
  orderIds,
}: {
  currentRole: AppRole | null;
  currentUserId: string | null;
  orderChangeLogs: WholesaleOrderChangeLog[];
  orderIds: Set<string>;
}) {
  if (canReadFullWholesaleBackoffice(currentRole)) return orderChangeLogs;
  if (!currentUserId) return [];

  return orderChangeLogs.filter(
    (log) => orderIds.has(log.order_id) || log.actor_user_id === currentUserId,
  );
}

export function scopeWholesaleOrderSettlements({
  currentRole,
  currentUserId,
  orderIds,
  orderSettlements,
}: {
  currentRole: AppRole | null;
  currentUserId: string | null;
  orderIds: Set<string>;
  orderSettlements: WholesaleOrderSettlement[];
}) {
  if (canReadFullWholesaleBackoffice(currentRole)) return orderSettlements;
  if (!currentUserId) return [];

  return orderSettlements.filter(
    (settlement) =>
      orderIds.has(settlement.order_id) ||
      settlement.created_by_user_id === currentUserId,
  );
}
