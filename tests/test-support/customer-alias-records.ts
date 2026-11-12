import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 页面创建前分配唯一名称和备注；不触碰固定客户，准备中断也能按精确归属回收。 */
export function createCustomerAliasFixture() {
  const token = randomUUID();
  return {
    customerName: `自动测试别名客户 ${token}`, marker: `customer-alias-fixture:${token}`,
    initialName: `原名称 ${token}`, aliasName: `自动测试别名 ${token}`, customerId: undefined as string | undefined,
  };
}
export type CustomerAliasFixture = ReturnType<typeof createCustomerAliasFixture>;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** 第一次按唯一名称定位，随后固定真实ID；归属/版本缺失时拒绝，不把未知正文当作成功。 */
async function readOwnedCustomer(admin: SupabaseClient, fixture: CustomerAliasFixture) {
  const { data, error } = await admin.from("wholesale_customers")
    .select("id,unique_name,notes,other_names,edit_revision,customer_kind,registered_user_id,created_by_user_id")
    .eq(fixture.customerId ? "id" : "unique_name", fixture.customerId ?? fixture.customerName).maybeSingle();
  if (error) throw error;
  if (data === null) return null;
  if (!data || !uuid.test(data.id) || data.unique_name !== fixture.customerName || data.notes !== fixture.marker
    || data.customer_kind !== "sales_created" || data.registered_user_id !== null || !uuid.test(data.created_by_user_id)
    || !Number.isSafeInteger(data.edit_revision) || data.edit_revision < 1 || !Array.isArray(data.other_names)
    || data.other_names.some((name: unknown) => typeof name !== "string" || !name.trim())
    || new Set(data.other_names).size !== data.other_names.length) {
    throw new Error("customer_alias_fixture_record_unconfirmed");
  }
  if (fixture.customerId && data.id !== fixture.customerId) throw new Error("customer_alias_fixture_id_changed");
  fixture.customerId = data.id;
  return data;
}

/** 独立数据库读取核对名称集合和精确修订；页面提示和刷新都不能替代这份凭证。 */
export async function verifyCustomerAliasRecord(admin: SupabaseClient, fixture: CustomerAliasFixture, names: string[], revision: number) {
  const record = await readOwnedCustomer(admin, fixture);
  if (!record || record.edit_revision !== revision || record.other_names.length !== names.length
    || names.some(name => !record.other_names.includes(name))) throw new Error("customer_alias_fixture_saved_state_missing");
  return { id: record.id as string, revision: record.edit_revision as number, names: [...record.other_names] as string[] };
}

/** 删除条件包含读取时的归属和修订；并发变更会影响零行而失败，随后独立核对ID/名称。 */
export async function cleanupCustomerAliasRecord(admin: SupabaseClient, fixture: CustomerAliasFixture) {
  const record = await readOwnedCustomer(admin, fixture);
  if (record) {
    const { data, error } = await admin.from("wholesale_customers").delete()
      .eq("id", record.id).eq("unique_name", fixture.customerName).eq("notes", fixture.marker)
      .eq("customer_kind", "sales_created").is("registered_user_id", null)
      .eq("created_by_user_id", record.created_by_user_id).eq("edit_revision", record.edit_revision).select("id");
    if (error || !Array.isArray(data) || data.length !== 1 || data[0]?.id !== record.id) {
      throw error ?? new Error("customer_alias_fixture_delete_unconfirmed");
    }
  }
  const filters: [string, string][] = [["unique_name", fixture.customerName]];
  if (fixture.customerId) filters.push(["id", fixture.customerId]);
  for (const [column, value] of filters) {
    const { count, error } = await admin.from("wholesale_customers").select("id", { count: "exact", head: true }).eq(column, value);
    if (error || count !== 0) throw error ?? new Error("customer_alias_fixture_remaining_unknown");
  }
}
