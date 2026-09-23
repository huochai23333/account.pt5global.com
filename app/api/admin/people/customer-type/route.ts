import { NextResponse } from "next/server";

import {
  updateAdminCustomerTypeMark,
  type AdminCustomerTypeUpdatePayload,
} from "@/lib/admin-people-customer-type-mutations";
import {
  getAdminPeopleUpdateErrorCode,
  type AdminPeopleUpdateErrorCode,
} from "@/lib/admin-people-mutations";
import { isCustomerTypeMark } from "@/lib/admin-people";
import { getServerSupabaseClient } from "@/lib/supabase-server";

const STATUS_BY_ERROR_CODE = {
  forbidden: 403,
  invalidInput: 400,
  lastAdmin: 409,
  noChange: 409,
  conflict: 409,
  notFound: 404,
  selfChange: 409,
  serviceUnavailable: 503,
  unknown: 500,
} as const satisfies Record<AdminPeopleUpdateErrorCode, number>;

export async function POST(request: Request) {
  try {
    const payload = normalizeRequestPayload(await request.json());
    const supabase = await getServerSupabaseClient();
    const person = await updateAdminCustomerTypeMark(supabase, payload);

    return NextResponse.json({ person });
  } catch (error) {
    const code = getAdminPeopleUpdateErrorCode(error);

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
): AdminCustomerTypeUpdatePayload {
  if (!isRecord(value) || !isCustomerTypeMark(value.customerType)) {
    throw new Error("admin_people_invalid_input");
  }

  return {
    customerType: value.customerType,
    customerUserId:
      typeof value.customerUserId === "string" ? value.customerUserId : "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
