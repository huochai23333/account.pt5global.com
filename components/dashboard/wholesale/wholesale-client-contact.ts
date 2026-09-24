import type { WholesaleOrderListItem } from "@/lib/wholesale";

/** 负责人 ID 存在但资料不可见时，不能把它误写成“未分配”。 */
export function getClientOrderContactName(order: WholesaleOrderListItem, contacts: Record<string, string>, unassigned: string, unavailable: string) {
  if (!order.sales_user_id) return unassigned;
  return contacts[order.id] || unavailable;
}
