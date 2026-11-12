import { addClientToBusiness, CLIENT_BUSINESS_RECEIPT_UNCONFIRMED } from "@/lib/client-business-access";
import { requireMutationRecord } from "@/lib/mutation-receipts";
import { getBrowserSupabaseClient } from "@/lib/supabase";

import { requiredString, toWholesaleActionErrorMessage } from "./wholesale-action-utils";
import type { RunWholesaleAction } from "./use-wholesale-action-runner";

export type AddRegisteredWholesaleCustomer = (userId: string, onError: (message: string) => void) => Promise<boolean>;

type BusinessAddErrorKey = "unconfirmed" | "forbidden" | "invalidTarget" | "unknownError";

function getBusinessAddErrorKey(error: unknown): BusinessAddErrorKey {
  if (typeof error !== "object" || error === null) return "unknownError";
  const message = "message" in error ? error.message : null;
  if (("code" in error && error.code === "") || message === CLIENT_BUSINESS_RECEIPT_UNCONFIRMED) return "unconfirmed";
  if (message === "admin_customer_business_forbidden") return "forbidden";
  if (typeof message === "string" && message.startsWith("admin_customer_business_target_")) return "invalidTarget";
  return "unknownError";
}

/** 纳入业务和关联档案都针对注册用户；档案自身的增删改由另一组操作维护。 */
export function createWholesaleCustomerAccountActions({
  runAction,
  addedMessage,
  addFeedback,
  linkedMessage,
  unconfirmedMessage,
}: {
  runAction: RunWholesaleAction;
  addedMessage: string;
  addFeedback: (key: BusinessAddErrorKey) => string;
  linkedMessage: string;
  unconfirmedMessage: string;
}) {
  return {
    addRegisteredCustomer: (userId: string, onError: (message: string) => void) =>
      runAction(`customer:add-business:${userId}`, addedMessage, async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        await addClientToBusiness(supabase, userId, "wholesale");
      }, {
        // 若请求已经提交，刷新后会按实际权限更新候选；保留搜索供用户先核对。
        onError,
        getErrorMessage: (error) => addFeedback(getBusinessAddErrorKey(error)),
      }),
    linkCustomerAccount: (formData: FormData, onError?: (message: string) => void) => {
      const customerId = requiredString(formData.get("customer_id"));
      return runAction(`customer:link-account:${customerId}`, linkedMessage, async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        const registeredUserId = requiredString(formData.get("registered_user_id"));
        const { data, error } = await supabase.rpc("link_wholesale_customer_registered_user", {
          p_customer_id: customerId,
          p_registered_user_id: registeredUserId,
        });
        if (error) throw error;
        // 回执必须同时确认原档案和所选账号，避免误把空结果当作合并完成。
        const receipt = requireMutationRecord(data, "wholesale_customer_link_unconfirmed");
        if (
          receipt.id !== customerId ||
          receipt.registered_user_id !== registeredUserId ||
          receipt.customer_kind !== "registered_account"
        ) {
          throw new Error("wholesale_customer_link_unconfirmed");
        }
      }, {
        onError,
        getErrorMessage: (error) => {
          // 网络中断或回执不完整时，保留所选账号，让用户先核对当前档案。
          if (typeof error === "object" && error !== null && "code" in error && error.code === "") {
            return unconfirmedMessage;
          }
          if (error instanceof Error && error.message === "wholesale_customer_link_unconfirmed") {
            return unconfirmedMessage;
          }
          return toWholesaleActionErrorMessage(error);
        },
      });
    },
  };
}
