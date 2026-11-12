import type { SalesmanBusinessBoard } from "./salesman-business-access";
import type { UserStatus } from "./user-self-service";

// 供原销售人员页和标记接口共享，页面选项沿用当前业务范围。
export const SALESMAN_CUSTOMER_TYPE_OPTIONS = ["retail"] as const;

export type SalesmanCustomerType =
  (typeof SALESMAN_CUSTOMER_TYPE_OPTIONS)[number];

export type SalesmanCustomerRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  status: UserStatus;
  customer_type: SalesmanCustomerType | null;
  marked_at: string | null;
  created_at: string;
  private_note: string | null;
};

export type SalesmanPeoplePageData = {
  businessBoards: SalesmanBusinessBoard[];
  hasPermission: boolean;
  currentViewerId: string | null;
  customers: SalesmanCustomerRow[];
};

export function isSalesmanCustomerType(
  value: unknown,
): value is SalesmanCustomerType {
  return value === "retail";
}

export function getSalesmanCustomerTypeOptionsForBusinessBoards(
  businessBoards: readonly SalesmanBusinessBoard[],
): SalesmanCustomerType[] {
  const options: SalesmanCustomerType[] = [];

  if (businessBoards.includes("tourism")) {
    options.push("retail");
  }

  return options;
}
