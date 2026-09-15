"use client";

import { getBrowserSupabaseClient } from "@/lib/supabase";
import { addClientToBusiness } from "@/lib/client-business-access";

import {
  optionalString,
  requiredString,
  splitList,
} from "./wholesale-action-utils";
import {
  addWholesaleCustomerOtherNames,
  deleteWholesaleCustomer,
  updateWholesaleCustomer,
} from "./wholesale-customer-mutations";

type RunAction = (
  key: string,
  successMessage: string,
  action: () => Promise<void>,
) => Promise<boolean>;

export function createWholesaleCustomerActions({
  addRegisteredCustomerSuccessMessage,
  runAction,
}: {
  addRegisteredCustomerSuccessMessage: string;
  runAction: RunAction;
}) {
  const addRegisteredCustomer = (userId: string) =>
    runAction(
      `customer:add-business:${userId}`,
      addRegisteredCustomerSuccessMessage,
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        await addClientToBusiness(supabase, userId, "wholesale");
      },
    );

  const createCustomer = (formData: FormData) =>
    runAction("customer:create", "批发客户已保存。", async () => {
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
      if (!data) throw new Error("批发客户没有保存成功。");
    });

  const updateCustomer = (formData: FormData) => {
    const customerId = requiredString(formData.get("customer_id"));

    return runAction(
      `customer:update:${customerId}`,
      "客户信息已更新。",
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        await updateWholesaleCustomer(supabase, formData);
      },
    );
  };

  const deleteCustomer = (customerId: string) =>
    runAction(
      `customer:delete:${customerId}`,
      "客户已删除。",
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        await deleteWholesaleCustomer(supabase, customerId);
      },
    );

  const linkCustomerAccount = (formData: FormData) => {
    const customerId = requiredString(formData.get("customer_id"));

    return runAction(
      `customer:link-account:${customerId}`,
      "批发客户和注册账号已合并。",
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        const registeredUserId = requiredString(
          formData.get("registered_user_id"),
        );
        const { data, error } = await supabase.rpc(
          "link_wholesale_customer_registered_user",
          {
            p_customer_id: customerId,
            p_registered_user_id: registeredUserId,
          },
        );

        if (error) throw error;
        if (
          typeof data !== "object"
          || data === null
          || !("id" in data)
          || data.id !== customerId
          || !("registered_user_id" in data)
          || data.registered_user_id !== registeredUserId
        ) {
          throw new Error("客户账号关联结果没有确认，请刷新后重试。");
        }
      },
    );
  };

  const addCustomerOtherName = (formData: FormData) => {
    const customerId = requiredString(formData.get("customer_id"));

    return runAction(
      `customer:add-other-name:${customerId}`,
      "客户其他名称已保存。",
      async () => {
        const supabase = getBrowserSupabaseClient();
        if (!supabase) throw new Error("client unavailable");

        await addWholesaleCustomerOtherNames(supabase, formData);
      },
    );
  };

  return {
    addCustomerOtherName,
    addRegisteredCustomer,
    createCustomer,
    deleteCustomer,
    linkCustomerAccount,
    updateCustomer,
  };
}
