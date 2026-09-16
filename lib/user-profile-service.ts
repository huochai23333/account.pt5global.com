import type { SupabaseClient, User } from "@supabase/supabase-js";

import type { AppRole } from "./auth-routing";
import type { UserProfileRow } from "./user-self-service-types";
import { withRequestTimeout } from "./request-timeout";
import { requireProfileWriteReceipt } from "./profile-operation-receipts";
import { normalizeOptionalString } from "./value-normalizers";

const PROFILE_MUTATION_TIMEOUT_MS = 20_000;
const PROFILE_MUTATION_TIMEOUT_MESSAGE = "资料更新超时，请稍后重试。";
const PROFILE_COLUMNS =
  "user_id,name,phone,email,status,city,referral_code,created_at";

export async function updateUserProfileCity(
  supabase: SupabaseClient,
  options: { userId: string; city: string },
) {
  const { data, error } = await withRequestTimeout(
    supabase
      .from("user_profiles")
      .update({ city: options.city.trim() })
      .eq("user_id", options.userId)
      .select(PROFILE_COLUMNS)
      .maybeSingle<UserProfileRow>(),
    {
      timeoutMs: PROFILE_MUTATION_TIMEOUT_MS,
      message: PROFILE_MUTATION_TIMEOUT_MESSAGE,
    },
  );
  if (error) throw error;
  requireProfileWriteReceipt(data, {
    city: options.city.trim(),
    userId: options.userId,
  });
  return data;
}

/**
 * 老账号可能先在 Auth 元数据保存城市、稍后才创建业务资料。
 * 只有资料城市为空时才补写，绝不会覆盖用户之后在工作台主动修改的值。
 */
export async function syncProfileFromAuthMetadataIfPossible(
  supabase: SupabaseClient,
  user: User,
  profile: UserProfileRow | null,
  role: AppRole | null,
) {
  if (!profile) return profile;
  const metadataCity = normalizeOptionalString(user.user_metadata?.city);
  if (!metadataCity || profile.city) return profile;
  if (role !== "administrator" && profile.status !== "active") return profile;

  try {
    const { data, error } = await withRequestTimeout(
      supabase
        .from("user_profiles")
        .update({ city: metadataCity })
        .eq("user_id", user.id)
        .select(PROFILE_COLUMNS)
        .maybeSingle<UserProfileRow>(),
    );
    return error ? profile : (data ?? profile);
  } catch {
    // 元数据同步是资料读取的附加修复，失败时仍应允许用户查看已有资料。
    return profile;
  }
}
