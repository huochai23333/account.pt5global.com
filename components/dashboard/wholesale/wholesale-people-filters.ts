import type { WholesaleCustomer, WholesaleProfile } from "@/lib/wholesale";
import { normalizeSearchText } from "@/lib/value-normalizers";
import { getProfileName } from "./wholesale-display";

export const ALL_DIRECTORY_ITEMS = "all";

// 搜索只处理服务端已授权返回的档案。负责人和关联账号按用户编号匹配。
export function filterWholesaleCustomers(
  customers: WholesaleCustomer[],
  profilesById: Map<string, WholesaleProfile>,
  { search, kind, owner }: { search: string; kind: string; owner: string },
) {
  const term = normalizeSearchText(search);
  return customers.filter((customer) => {
    if (kind !== ALL_DIRECTORY_ITEMS && customer.customer_kind !== kind) return false;
    if (owner !== ALL_DIRECTORY_ITEMS && (customer.assigned_sales_user_id ?? "") !== owner) return false;
    if (!term) return true;

    const assignedSales = getProfileName(profilesById, customer.assigned_sales_user_id);
    const linkedProfile = customer.registered_user_id
      ? profilesById.get(customer.registered_user_id)
      : null;

    return [
      customer.unique_name,
      customer.other_names.join(" "),
      customer.contact_details,
      customer.source,
      customer.notes,
      assignedSales,
      linkedProfile?.name,
      linkedProfile?.email,
      linkedProfile?.phone,
    ].some((value) => normalizeSearchText(value).includes(term));
  });
}

// 账号的身份和状态与客户档案类型是两套筛选条件。
export function filterWholesaleSalesAccounts(
  accounts: WholesaleProfile[],
  { search, role, status }: { search: string; role: string; status: string },
) {
  const term = normalizeSearchText(search);
  return accounts.filter((profile) => {
    if (role !== ALL_DIRECTORY_ITEMS && profile.role !== role) return false;
    if (status !== ALL_DIRECTORY_ITEMS && profile.status !== status) return false;
    if (!term) return true;
    return [profile.name, profile.email, profile.phone, profile.city, profile.role, profile.status]
      .some((value) => normalizeSearchText(value).includes(term));
  });
}
