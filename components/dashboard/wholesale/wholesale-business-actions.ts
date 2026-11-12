import { getBrowserSupabaseClient } from "@/lib/supabase";
import { settlePendingWholesaleCommission } from "@/lib/wholesale-commission-settlement";

import { requiredString } from "./wholesale-action-utils";
import type { RunWholesaleAction } from "./use-wholesale-action-runner";

/** 汇总体量较小的推荐和佣金写操作，避免主 hook 承载具体请求。 */
export function createWholesaleBusinessActions(
  runAction: RunWholesaleAction,
  commissionFeedback: { saved: string; changed: string; unconfirmed: string },
) {
  const createReferral = (formData: FormData) =>
    runAction("referral:create", "批发推荐关系已保存。", async () => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("client unavailable");

      const { data, error } = await supabase.from("wholesale_referrals").insert({
        referred_customer_id: requiredString(
          formData.get("referred_customer_id"),
        ),
        referrer_customer_id: requiredString(
          formData.get("referrer_customer_id"),
        ),
      }).select("id").maybeSingle<{ id: string }>();
      if (error) throw error;
      if (!data) throw new Error("批发推荐关系没有保存成功。");
    });

  const settleCommission = (commissionId: string) =>
    runAction("commission:settle", commissionFeedback.saved, async () => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("client unavailable");

      const outcome = await settlePendingWholesaleCommission(supabase, commissionId);
      if (outcome !== "confirmed") throw new Error(outcome);
    }, {
      getErrorMessage: (error) => error instanceof Error && error.message === "changed"
        ? commissionFeedback.changed
        : commissionFeedback.unconfirmed,
    });

  return {
    createReferral,
    settleCommission,
  };
}
