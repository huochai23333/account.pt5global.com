import { NextResponse } from "next/server";

import { getServerSupabaseClient } from "@/lib/supabase-server";
import {
  getSalesmanPeopleUpdateErrorCode,
  updateSalesmanCustomerType,
  type SalesmanCustomerTypeUpdatePayload,
} from "@/lib/salesman-people-mutations";
import { isSalesmanCustomerType } from "@/lib/salesman-people-contract";

const STATUS_BY_ERROR_CODE = {
  forbidden: 403,
  invalidInput: 400,
  notFound: 404,
  serviceUnavailable: 503,
  unknown: 500,
} as const;

export async function POST(request: Request) {
  try {
    const payload = normalizeRequestPayload(await request.json());
    const supabase = await getServerSupabaseClient();
    const customer = await updateSalesmanCustomerType(supabase, payload);

    return NextResponse.json({ customer });
  } catch (error) {
    const code = getSalesmanPeopleUpdateErrorCode(error);

    return NextResponse.json(
      {
        error: code,
      },
      {
        status: STATUS_BY_ERROR_CODE[code],
      },
    );
  }
}

function normalizeRequestPayload(
  value: unknown,
): SalesmanCustomerTypeUpdatePayload {
  if (!isRecord(value) || !isSalesmanCustomerType(value.customerType)) {
    throw new Error("salesman_people_invalid_input");
  }

  return {
    customerUserId:
      typeof value.customerUserId === "string" ? value.customerUserId : "",
    customerType: value.customerType,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
