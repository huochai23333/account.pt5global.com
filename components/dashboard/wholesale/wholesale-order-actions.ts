import { getBrowserSupabaseClient } from "@/lib/supabase";
import { requireMutationId } from "@/lib/mutation-receipts";

import {
  getWholesaleOrderCreateRpcPayload,
  getWholesaleOrderRpcPayload,
  positiveNumber,
  requiredString,
  toWholesaleActionErrorMessage,
} from "./wholesale-action-utils";
import type { RunWholesaleAction } from "./use-wholesale-action-runner";

type RefreshWholesaleOrders = () => Promise<void>;
type WholesaleOrderActionMessages = {
  created: string;
  updated: string;
  settlementSaved: string;
  settlementUnconfirmed: string;
  settlementConflict: string;
  settlementRateMissing: string;
  refreshPending: string;
};

/** 把订单创建、直接修改和结汇集中在一个业务域内。 */
export function createWholesaleOrderActions(
  runAction: RunWholesaleAction,
  messages: WholesaleOrderActionMessages,
) {
  // 订单写入完成后保留列表筛选，只重读当前页。
  const refreshOptions = (afterSuccess: RefreshWholesaleOrders) => ({
    refreshMode: "none" as const,
    refreshPendingMessage: messages.refreshPending,
    afterSuccess,
  });
  const createOrder = (
    formData: FormData,
    refreshOrders: RefreshWholesaleOrders,
  ) =>
    runAction(
      "order:create",
      messages.created,
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        const { data, error } = await supabase.rpc(
          "create_wholesale_order",
          getWholesaleOrderCreateRpcPayload(formData),
        );
        if (error) throw error;
        requireMutationId(data, "批发订单没有返回保存编号。");
      },
      refreshOptions(refreshOrders),
    );

  const updateOrder = (
    formData: FormData,
    refreshOrders: RefreshWholesaleOrders,
  ) => {
    const orderId = requiredString(formData.get("order_id"));

    return runAction(
      `order:update:${orderId}`,
      messages.updated,
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        const { data, error } = await supabase.rpc("update_wholesale_order", {
          p_order_id: orderId,
          ...getWholesaleOrderRpcPayload(formData),
        });
        if (error) throw error;
        if (requireMutationId(data, "批发订单没有确认更新。") !== orderId) {
          throw new Error("更新结果与当前订单不一致。");
        }
      },
      refreshOptions(refreshOrders),
    );
  };

  const markOrderSettled = (
    formData: FormData,
    refreshOrders: RefreshWholesaleOrders,
  ) => {
    const orderId = requiredString(formData.get("order_id"));

    return runAction(
      `order:settle:${orderId}`,
      messages.settlementSaved,
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        const { data, error } = await supabase.rpc("add_wholesale_order_settlement", {
          p_order_id: orderId,
          p_settlement_amount: positiveNumber(
            formData.get("settlement_amount"),
          ),
          p_settlement_date: requiredString(formData.get("settlement_date")),
          p_settlement_request_id: requiredString(formData.get("settlement_request_id")),
        });
        if (error) throw error;
        requireMutationId(data, "结汇记录没有返回保存编号。");
      },
      {
        ...refreshOptions(refreshOrders),
        getErrorMessage: (error) => {
          // 断线或缺少回执时保留本次编号，重试先由数据库核对。
          if (typeof error !== "object" || error === null || !("code" in error) ||
            typeof error.code !== "string" || !/^[A-Z0-9]{5}$/.test(error.code)) {
            return messages.settlementUnconfirmed;
          }
          const message = "message" in error ? String(error.message) : "";
          if (message.includes("wholesale_order_settlement_request_conflict")) return messages.settlementConflict;
          if (message.includes("wholesale_order_settlement_rate_missing")) return messages.settlementRateMissing;
          return toWholesaleActionErrorMessage(error);
        },
      },
    );
  };

  return {
    createOrder,
    markOrderSettled,
    updateOrder,
  };
}
