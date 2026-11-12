"use client";

import { useEffect, useState } from "react";
import { getAdminOrderSupplementaryDetail, type AdminOrderSupplementaryDetail } from "@/lib/admin-orders";
import type { getBrowserSupabaseClient } from "@/lib/supabase";
import type { DashboardSharedCopy } from "../dashboard-shared-ui";
import type { OrdersUiCopy } from "./admin-orders-copy";
import { toOrderErrorMessage } from "./admin-orders-errors";

export function useAdminOrderSupplementaryDetail({
  orderNumber,
  orderUiCopy,
  sharedCopy,
  supabase,
}: {
  orderNumber: string | null;
  orderUiCopy: OrdersUiCopy;
  sharedCopy: DashboardSharedCopy;
  supabase: ReturnType<typeof getBrowserSupabaseClient>;
}) {
  const [supplementaryState, setSupplementaryState] = useState<{
    orderNumber: string | null;
    detail: AdminOrderSupplementaryDetail | null;
    error: string | null;
  }>({
    orderNumber: null,
    detail: null,
    error: null,
  });

  useEffect(() => {
    if (!orderNumber || !supabase) {
      return;
    }

    // 每次选择都绑定该订单编号；切换后旧请求不得更新新订单的详情。
    let isActive = true;

    void getAdminOrderSupplementaryDetail(supabase, orderNumber)
      .then((detail) => {
        if (!isActive) {
          return;
        }

        setSupplementaryState({
          orderNumber,
          detail,
          error: null,
        });
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setSupplementaryState({
          orderNumber,
          detail: null,
          error: toOrderErrorMessage(error, orderUiCopy, sharedCopy),
        });
      });

    return () => {
      isActive = false;
    };
  }, [orderNumber, orderUiCopy, sharedCopy, supabase]);

  const supplementaryLoading =
    orderNumber !== null && supplementaryState.orderNumber !== orderNumber;
  const supplementaryDetail =
    supplementaryState.orderNumber === orderNumber
      ? supplementaryState.detail
      : null;
  const supplementaryError =
    supplementaryState.orderNumber === orderNumber
      ? supplementaryState.error
      : null;
  return { supplementaryLoading, supplementaryDetail, supplementaryError };
}
