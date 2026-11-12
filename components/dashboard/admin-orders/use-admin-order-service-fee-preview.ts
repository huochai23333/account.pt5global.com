"use client";

import { useEffect, useState } from "react";

import { previewOrderServiceFeeType } from "@/lib/service-fee-types";
import type { getBrowserSupabaseClient } from "@/lib/supabase";

import { parseNumericValue } from "./admin-orders-display";
import type { OrderServiceFeePreviewState } from "./admin-orders-service-fee-preview";
import type { OrderFormState } from "./admin-orders-form";

export function useAdminOrderServiceFeePreview({
  enabled,
  existingOrderNumber,
  form,
  orderCategoryByTypeId,
  supabase,
}: {
  enabled: boolean;
  existingOrderNumber?: string | null;
  form: OrderFormState;
  orderCategoryByTypeId: Map<string, string | null>;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
}) {
  const [preview, setPreview] = useState<OrderServiceFeePreviewState>({ feeType: null, status: "idle" });
  const { orderType, orderingUser, rmbAmount } = form;

  useEffect(() => {
    if (!enabled || !supabase || !orderType || !orderingUser || orderCategoryByTypeId.get(orderType) !== "purchase") {
      setPreview({ feeType: null, status: "idle" });
      return;
    }

    // 关闭弹窗或更换订单参数后，之前的请求即使较晚返回也不能改写当前预览。
    let current = true;
    setPreview({ feeType: null, status: "loading" });
    void previewOrderServiceFeeType(supabase, {
      existingOrderNumber,
      orderType,
      orderingUser,
      rmbAmount: parseNumericValue(rmbAmount) ?? 0,
    }).then(
      (feeType) => { if (current) setPreview({ feeType, status: "ready" }); },
      () => { if (current) setPreview({ feeType: null, status: "error" }); },
    );
    return () => { current = false; };
  }, [enabled, existingOrderNumber, orderCategoryByTypeId, orderType, orderingUser, rmbAmount, supabase]);

  return preview;
}
