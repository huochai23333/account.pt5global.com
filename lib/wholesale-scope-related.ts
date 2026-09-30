import type { AppRole } from "./auth-routing";
import type {
  WholesaleCommission,
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleOrderChangeLog,
  WholesaleOrderSettlement,
  WholesaleProfile,
  WholesaleReferral,
} from "./wholesale-types";
import {
  canCollaborateAcrossWholesale,
  canReadFullWholesaleBackoffice,
  canReadFullWholesaleDirectory,
} from "./wholesale-role-permissions";

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

export function scopeWholesaleReferrals({
  currentRole,
  currentUserId,
  customerIds,
  referrals,
}: {
  currentRole: AppRole | null;
  currentUserId: string | null;
  customerIds: Set<string>;
  referrals: WholesaleReferral[];
}) {
  if (canReadFullWholesaleDirectory(currentRole)) return referrals;
  if (!currentUserId) return [];

  return referrals.filter(
    (referral) =>
      referral.created_by_user_id === currentUserId ||
      (customerIds.has(referral.referrer_customer_id) &&
        customerIds.has(referral.referred_customer_id)),
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

export function scopeWholesaleProfiles({
  currentRole,
  currentUserId,
  customers,
  orderChangeLogs,
  orders,
  profiles,
  registeredCandidates,
}: {
  currentRole: AppRole | null;
  currentUserId: string | null;
  customers: WholesaleCustomer[];
  orderChangeLogs: WholesaleOrderChangeLog[];
  orders: WholesaleOrder[];
  profiles: WholesaleProfile[];
  registeredCandidates: WholesaleProfile[];
}) {
  if (canReadFullWholesaleDirectory(currentRole)) return profiles;

  const visibleProfileIds = new Set<string>();
  addOptionalId(visibleProfileIds, currentUserId);

  for (const customer of customers) {
    addOptionalId(visibleProfileIds, customer.assigned_sales_user_id);
    addOptionalId(visibleProfileIds, customer.created_by_user_id);
    addOptionalId(visibleProfileIds, customer.registered_user_id);
  }

  for (const order of orders) {
    addOptionalId(visibleProfileIds, order.sales_user_id);
    addOptionalId(visibleProfileIds, order.created_by_user_id);
  }


  for (const log of orderChangeLogs) {
    addOptionalId(visibleProfileIds, log.actor_user_id);
  }

  for (const profile of registeredCandidates) {
    addOptionalId(visibleProfileIds, profile.user_id);
  }

  return profiles.filter((profile) => visibleProfileIds.has(profile.user_id));
}

function addOptionalId(ids: Set<string>, value: string | null | undefined) {
  if (value) ids.add(value);
}
