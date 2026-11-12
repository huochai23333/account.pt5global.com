import type { AppRole } from "./auth-routing";
import type {
  WholesaleCustomer,
  WholesaleOrder,
  WholesaleOrderChangeLog,
  WholesaleProfile,
  WholesaleReferral,
} from "./wholesale-types";
import { canReadFullWholesaleDirectory } from "./wholesale-role-permissions";

// 上游查询先应用数据库权限。这里再把已获准的数据收窄到当前目录和所需关联资料。
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
