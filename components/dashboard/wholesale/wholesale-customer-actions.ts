"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase";

import {
  optionalString,
  requiredString,
  splitList,
  toWholesaleActionErrorMessage,
} from "./wholesale-action-utils";
import {
  addWholesaleCustomerOtherNames,
  deleteWholesaleCustomer,
  updateWholesaleCustomer,
} from "./wholesale-customer-mutations";
import type { RunWholesaleAction } from "./use-wholesale-action-runner";

export type SubmitWholesaleCustomerForm = (
  formData: FormData,
  onError?: (message: string) => void,
) => boolean | Promise<boolean>;

export type DeleteWholesaleCustomerAction = (
  customerId: string,
  onError: (message: string) => void,
) => Promise<boolean>;

const deleteErrorKeys = {
  document_customer_has_files: "deleteHasDocuments",
  wholesale_customer_delete_has_orders: "deleteHasOrders",
  wholesale_customer_delete_has_sales_lead: "deleteHasLead",
  wholesale_customer_forbidden: "deleteForbidden",
  wholesale_customer_not_found: "deleteUnconfirmed",
} as const;

export type CustomerDeleteFeedbackKey =
  | (typeof deleteErrorKeys)[keyof typeof deleteErrorKeys]
  | "deleteFailed";

export function createWholesaleCustomerActions({
  recordFeedback,
  deleteFeedback,
  aliasFeedback,
  runAction,
}: {
  recordFeedback: {
    created: string;
    updated: string;
    deleted: string;
    editConflict: string;
    editUnconfirmed: string;
  };
  deleteFeedback: (key: CustomerDeleteFeedbackKey) => string;
  aliasFeedback: { saved: string; alreadyPresent: string; failed: string };
  runAction: RunWholesaleAction;
}) {
  const createCustomer = (formData: FormData) =>
    runAction("customer:create", recordFeedback.created, async () => {
      const supabase = getBrowserSupabaseClient();
      if (!supabase) throw new Error("client unavailable");

      const payload = {
        assigned_sales_user_id: optionalString(
          formData.get("assigned_sales_user_id"),
        ),
        contact_details: optionalString(formData.get("contact_details")),
        customer_kind: "sales_created",
        notes: optionalString(formData.get("notes")),
        other_names: splitList(formData.get("other_names")),
        source: optionalString(formData.get("source")),
        unique_name: requiredString(formData.get("unique_name")),
      };

      const { data, error } = await supabase
        .from("wholesale_customers")
        .insert(payload)
        .select("id")
        .maybeSingle<{ id: string }>();
      if (error) throw error;
      // 插入必须返回新档案编号，空响应不能关闭表单。
      if (!data?.id) throw new Error("wholesale_customer_create_receipt_missing");
    });

  const updateCustomer = (formData: FormData, onError?: (message: string) => void) => {
    const customerId = requiredString(formData.get("customer_id"));

    return runAction(
      `customer:update:${customerId}`,
      recordFeedback.updated,
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        await updateWholesaleCustomer(supabase, formData);
      },
      {
        onError,
        getErrorMessage: (error) => {
          if (typeof error === "object" && error !== null && "code" in error) {
            if (error.code === "PT409") return recordFeedback.editConflict;
            // 请求失联时可能已经写入，指导用户核对当前资料再决定是否重试。
            if (error.code === "") return recordFeedback.editUnconfirmed;
          }
          return toWholesaleActionErrorMessage(error);
        },
      },
    );
  };

  const deleteCustomer: DeleteWholesaleCustomerAction = (customerId, onError) =>
    runAction(
      `customer:delete:${customerId}`,
      recordFeedback.deleted,
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        await deleteWholesaleCustomer(supabase, customerId);
      },
      {
        onError,
        getErrorMessage: (error) => {
          if (typeof error === "object" && error !== null) {
            // 已知数据库保护条件各有处理提示。断线时必须先刷新确认档案还在不在。
            if ("code" in error && error.code === "") return deleteFeedback("deleteUnconfirmed");
            if ("message" in error && typeof error.message === "string" && Object.hasOwn(deleteErrorKeys, error.message)) {
              return deleteFeedback(deleteErrorKeys[error.message as keyof typeof deleteErrorKeys]);
            }
          }
          return deleteFeedback("deleteFailed");
        },
      },
    );

  const addCustomerOtherName = (formData: FormData) => {
    const customerId = requiredString(formData.get("customer_id"));

    return runAction(
      `customer:add-other-name:${customerId}`,
      aliasFeedback.saved,
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        // 重复名称不改数据库版本，单独提示用户核对已有名称。
        if (!(await addWholesaleCustomerOtherNames(supabase, formData))) {
          throw new Error("wholesale_customer_alias_already_present");
        }
      },
      {
        getErrorMessage: (error) =>
          error instanceof Error && error.message === "wholesale_customer_alias_already_present"
            ? aliasFeedback.alreadyPresent
            : aliasFeedback.failed,
      },
    );
  };

  return {
    addCustomerOtherName,
    createCustomer,
    deleteCustomer,
    updateCustomer,
  };
}
