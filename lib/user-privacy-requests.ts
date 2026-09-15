import type { SupabaseClient } from "@supabase/supabase-js";

import { withRequestTimeout } from "./request-timeout";

const PRIVACY_REQUEST_TIMEOUT_MS = 20_000;
const PRIVACY_REQUEST_TIMEOUT_MESSAGE = "资料申请提交超时，请稍后重试。";

export async function createPrivacyRequest(
  supabase: SupabaseClient,
  options: {
    field: "id_card" | "passport";
    userId: string;
    value: string;
  },
) {
  const trimmedValue = options.value.trim();
  const payload =
    options.field === "id_card"
      ? { user_id: options.userId, id_card_requests: trimmedValue }
      : { user_id: options.userId, passport_requests: trimmedValue };
  const { data, error } = await withRequestTimeout(
    supabase.from("user_privacy_requests").insert(payload).select("id").maybeSingle<{ id: string }>(),
    {
      timeoutMs: PRIVACY_REQUEST_TIMEOUT_MS,
      message: PRIVACY_REQUEST_TIMEOUT_MESSAGE,
    },
  );
  if (error) throw error;
  if (!data) throw new Error("资料申请没有提交成功，请稍后重试。");
}
