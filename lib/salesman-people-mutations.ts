import type { SupabaseClient } from "@supabase/supabase-js";

import { getSalesmanCustomerRowById, normalizeSalesmanCustomerRow } from "./salesman-people";
import {
  isSalesmanCustomerType,
  type SalesmanCustomerRow,
  type SalesmanCustomerType,
} from "./salesman-people-contract";
import { withRequestTimeout } from "./request-timeout";
import { getCurrentSessionContext } from "./user-self-service";
import { isSalesStaffRole } from "./sales-staff-roles";

export type SalesmanPeopleUpdateErrorCode =
  | "forbidden"
  | "invalidInput"
  | "notFound"
  | "serviceUnavailable"
  | "unknown";

export type SalesmanCustomerTypeUpdatePayload = {
  customerUserId: string;
  customerType: SalesmanCustomerType;
};

export class SalesmanPeopleMutationError extends Error {
  readonly code: SalesmanPeopleUpdateErrorCode;

  constructor(code: SalesmanPeopleUpdateErrorCode) {
    super(code);
    this.code = code;
  }
}

export async function updateSalesmanCustomerType(
  supabase: SupabaseClient,
  input: SalesmanCustomerTypeUpdatePayload,
): Promise<SalesmanCustomerRow> {
  const sessionContext = await getCurrentSessionContext(supabase);

  if (
    !sessionContext.user ||
    !isSalesStaffRole(sessionContext.role) ||
    sessionContext.status !== "active"
  ) {
    throw new SalesmanPeopleMutationError("forbidden");
  }

  const payload = normalizePayload(input);
  const { data, error } = await withRequestTimeout(
    supabase.rpc("set_salesman_customer_type", {
      _customer_user_id: payload.customerUserId,
      _customer_type: payload.customerType,
    }),
  );

  if (error) {
    throw error;
  }

  const rpcCustomer = Array.isArray(data)
    ? normalizeSalesmanCustomerRow(data[0])
    : normalizeSalesmanCustomerRow(data);

  if (!rpcCustomer || rpcCustomer.user_id !== payload.customerUserId) {
    throw new SalesmanPeopleMutationError("notFound");
  }

  const updatedCustomer = await getSalesmanCustomerRowById(
    supabase,
    payload.customerUserId,
  );

  if (!updatedCustomer) {
    throw new SalesmanPeopleMutationError("notFound");
  }

  // 数据库读回必须是本次写入的标记，避免目标行未修改时返回成功。
  if (updatedCustomer.customer_type !== payload.customerType) {
    throw new SalesmanPeopleMutationError("unknown");
  }

  return updatedCustomer;
}

export function getSalesmanPeopleUpdateErrorCode(
  error: unknown,
): SalesmanPeopleUpdateErrorCode {
  if (error instanceof SalesmanPeopleMutationError) {
    return error.code;
  }

  const message = getRawErrorMessage(error).toLowerCase();

  if (
    message.includes("salesman_people_forbidden") ||
    message.includes("permission") ||
    message.includes("forbidden") ||
    message.includes("unauthorized")
  ) {
    return "forbidden";
  }

  if (
    message.includes("salesman_people_invalid_input") ||
    message.includes("invalid input")
  ) {
    return "invalidInput";
  }

  if (message.includes("salesman_people_customer_not_found")) {
    return "notFound";
  }

  if (
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("timed out") ||
    message.includes("timeout")
  ) {
    return "serviceUnavailable";
  }

  return "unknown";
}

function normalizePayload(
  input: SalesmanCustomerTypeUpdatePayload,
): SalesmanCustomerTypeUpdatePayload {
  const customerUserId =
    typeof input.customerUserId === "string" ? input.customerUserId.trim() : "";

  if (!customerUserId || !isSalesmanCustomerType(input.customerType)) {
    throw new SalesmanPeopleMutationError("invalidInput");
  }

  return {
    customerUserId,
    customerType: input.customerType,
  };
}

function getRawErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message).trim();
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "";
}
