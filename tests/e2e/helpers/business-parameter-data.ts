import { expect, test } from "@playwright/test";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getLocalSupabaseAdminClient } from "./local-supabase-admin";

export function requireLocalAdminClient() {
  const admin = getLocalSupabaseAdminClient();
  test.skip(!admin, "必须连接本地 Docker Supabase 才能核对参数版本凭证。");
  if (!admin) throw new Error("local_supabase_admin_required");
  return admin;
}

export async function readLatestVersion(admin: SupabaseClient, code: string) {
  const { data, error } = await admin
    .from("business_parameter_versions")
    .select("id,version_number,config,effective_from,cancelled_at")
    .eq("parameter_code", code)
    .order("version_number", { ascending: false })
    .limit(1)
    .single();
  if (error) throw error;
  return data as {
    cancelled_at: string | null;
    config: Record<string, number>;
    effective_from: string;
    id: string;
    version_number: number;
  };
}

export async function readVersion(admin: SupabaseClient, id: string) {
  const { data, error } = await admin
    .from("business_parameter_versions")
    .select("id,version_number,config,effective_from,cancelled_at")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Awaited<ReturnType<typeof readLatestVersion>>;
}

export async function countVersions(admin: SupabaseClient, code: string) {
  const { count, error } = await admin
    .from("business_parameter_versions")
    .select("id", { count: "exact", head: true })
    .eq("parameter_code", code);
  if (error) throw error;
  if (count === null) throw new Error("parameter_version_count_missing");
  return count;
}

/** 会删除版本二及以后的全局记录，只能由已通过隔离准入的原测试调用。 */
export async function resetParameter(admin: SupabaseClient, code: string) {
  const { data, error: readError } = await admin
    .from("business_parameter_versions")
    .select("id")
    .eq("parameter_code", code)
    .gt("version_number", 1);
  if (readError) throw readError;
  const ids = (data ?? []).map((row) => row.id);
  if (ids.length > 0) {
    const { error } = await admin
      .from("business_parameter_versions")
      .delete()
      .in("id", ids);
    if (error) throw error;
  }
  const { data: definition, error } = await admin
    .from("business_parameter_definitions")
    .update({ current_revision: 1 })
    .eq("parameter_code", code)
    .select("parameter_code,current_revision")
    .single();
  if (error) throw error;
  // 请求成功却命中零行不能算恢复完成，版本表与定义表必须分别核对。
  expect(definition).toEqual({ parameter_code: code, current_revision: 1 });
  if ((await countVersions(admin, code)) !== 1) throw new Error("parameter_test_cleanup_failed");
}

export async function readOrderByNote(admin: SupabaseClient, note: string) {
  const { data, error } = await admin
    .from("wholesale_orders")
    .select("id,salesman_commission_parameter_version_id,commission_rate")
    .eq("notes", note)
    .single();
  if (error) throw error;
  return data as {
    commission_rate: number | null;
    id: string;
    salesman_commission_parameter_version_id: string;
  };
}

export async function deleteOrdersByNotes(admin: SupabaseClient, notes: string[]) {
  const { error } = await admin
    .from("wholesale_orders")
    .delete()
    .in("notes", notes);
  if (error) throw error;
  const { count, error: readError } = await admin
    .from("wholesale_orders")
    .select("id", { count: "exact", head: true })
    .in("notes", notes);
  if (readError) throw readError;
  expect(count).toBe(0);
}
