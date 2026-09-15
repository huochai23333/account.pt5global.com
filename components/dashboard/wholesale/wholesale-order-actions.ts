import { getBrowserSupabaseClient } from "@/lib/supabase";
import { requireMutationId } from "@/lib/mutation-receipts";

import {
  getWholesaleOrderCreateRpcPayload,
  getWholesaleOrderRpcPayload,
  positiveNumber,
  requiredString,
} from "./wholesale-action-utils";
import type { RunWholesaleAction } from "./use-wholesale-action-runner";

type RefreshWholesaleOrders = () => Promise<void>;

/** 订单列表由客户端局部刷新，所以这些操作成功后不再额外刷新整页。 */
const ORDER_ACTION_OPTIONS = { refreshMode: "none" } as const;

/** 把订单创建、直接修改和结汇集中在一个业务域内。 */
export function createWholesaleOrderActions(runAction: RunWholesaleAction) {
  const createOrder = (
    formData: FormData,
    refreshOrders: RefreshWholesaleOrders,
  ) =>
    runAction(
      "order:create",
      "批发订单已保存。",
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
      { ...ORDER_ACTION_OPTIONS, afterSuccess: refreshOrders },
    );

  const updateOrder = (
    formData: FormData,
    refreshOrders: RefreshWholesaleOrders,
  ) => {
    const orderId = requiredString(formData.get("order_id"));

    return runAction(
      `order:update:${orderId}`,
      "批发订单已更新。",
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
      { ...ORDER_ACTION_OPTIONS, afterSuccess: refreshOrders },
    );
  };

  const markOrderSettled = (
    formData: FormData,
    refreshOrders: RefreshWholesaleOrders,
  ) => {
    const orderId = requiredString(formData.get("order_id"));

    return runAction(
      `order:settle:${orderId}`,
      "结汇记录已保存。",
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        const { data, error } = await supabase.rpc("add_wholesale_order_settlement", {
          p_order_id: orderId,
          p_settlement_amount: positiveNumber(
            formData.get("settlement_amount"),
          ),
          p_settlement_date: requiredString(formData.get("settlement_date")),
        });
        if (error) throw error;
        requireMutationId(data, "结汇记录没有返回保存编号。");
      },
      { ...ORDER_ACTION_OPTIONS, afterSuccess: refreshOrders },
    );
  };

  return {
    createOrder,
    markOrderSettled,
    updateOrder,
  };
}
