import { queryCompleteDashboardRows, type DashboardCollectionQuery } from "./dashboard-complete-query";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { AppRole } from "./auth-routing";
import type { WholesaleProfile } from "./wholesale";

/**
 * 读取批发页面需要的账号资料。
 *
 * 普通批发页面只需要可见账号；客户管理还要额外读取数据库已经核实过的
 * 可关联客户候选。把这部分查询从批发聚合文件拆出，避免页面数据模块继续膨胀。
 */
export async function getWholesaleProfiles(
  supabase: SupabaseClient,
  includeLinkCandidates: boolean,
) {
  const result = await getWholesaleProfilesWithCandidates(
    supabase,
    includeLinkCandidates,
  );

  return result.profiles;
}

export async function getWholesaleProfilesWithCandidates(
  supabase: SupabaseClient,
  includeLinkCandidates: boolean,
) {
  const [profiles, roleRows, roles, registeredCandidates] = await Promise.all([
    queryProfileRows<Omit<WholesaleProfile, "role">>(
      supabase
        .from("user_profiles")
        .select("user_id,name,email,phone,status,city")
        .order("created_at", { ascending: false }).order("user_id", { ascending: false }),
      "账号资料",
    ),
    queryProfileRows<{ user_id: string; role_id: string }>(
      supabase.from("user_roles_data").select("user_id,role_id").order("user_id"),
      "账号身份关联",
    ),
    queryProfileRows<{ id: string; role: AppRole }>(
      supabase.from("user_roles").select("id,role").order("id"),
      "账号身份",
    ),
    includeLinkCandidates
      ? queryProfileRows<WholesaleProfile>(
          supabase.rpc("list_wholesale_customer_link_candidates").order("user_id"),
          "可关联客户账号",
        )
      : Promise.resolve([]),
  ]);
  const rolesById = new Map(roles.map((roleRow) => [roleRow.id, roleRow.role]));
  const roleByUserId = new Map(
    roleRows.map((roleRow) => [
      roleRow.user_id,
      rolesById.get(roleRow.role_id) ?? null,
    ]),
  );
  const profilesByUserId = new Map(
    profiles.map((profile) => [
      profile.user_id,
      { ...profile, role: roleByUserId.get(profile.user_id) ?? null },
    ]),
  );

  for (const candidate of registeredCandidates) {
    profilesByUserId.set(candidate.user_id, candidate);
  }

  return {
    profiles: Array.from(profilesByUserId.values()),
    registeredCandidates,
  };
}

async function queryProfileRows<T>(
  query: DashboardCollectionQuery<T>,
  label: string,
): Promise<T[]> {
  const result = await queryCompleteDashboardRows(query);

  if (result.error) {
    throw new Error(`${label}暂时没有加载成功，请稍后再试。`, {
      cause: result.error,
    });
  }

  return result.data ?? [];
}
