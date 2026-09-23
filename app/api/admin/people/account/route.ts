import { NextResponse } from "next/server";

import {
  getAdminPeopleUpdateErrorCode,
  updateAdminPersonAccount,
} from "@/lib/admin-people-mutations";
import {
  getAdminPeopleChangeLogs,
  isAdminPeopleRole,
  isAdminPeopleStatus,
  type AdminPersonAccountUpdatePayload,
} from "@/lib/admin-people";
import { getServerSupabaseClient } from "@/lib/supabase-server";
import { isSalesmanBusinessBoard } from "@/lib/salesman-business-access";
import { isWorkspaceBusinessAccessKey } from "@/lib/workspace-business-access";

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
} as const;

export async function POST(request: Request) {
  try {
    const payload = normalizeRequestPayload(await request.json());
    const supabase = await getServerSupabaseClient();
    const { person, outcome } = await updateAdminPersonAccount(supabase, payload);
    const recentChanges = await getAdminPeopleChangeLogs(supabase);

    return NextResponse.json({ person, recentChanges, outcome });
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
): AdminPersonAccountUpdatePayload {
  if (!isRecord(value)) {
    throw new Error("admin_people_invalid_input");
  }

  if (
    !isAdminPeopleRole(value.nextRole) ||
    !isAdminPeopleStatus(value.nextStatus) ||
    !isRecord(value.expected) ||
    !isAdminPeopleStatus(value.expected.status) ||
    !(value.expected.role === null || isAdminPeopleRole(value.expected.role)) ||
    !Array.isArray(value.expected.workspace_business_access) ||
    !Array.isArray(value.expected.salesman_business_boards) ||
    !value.expected.workspace_business_access.every(isWorkspaceBusinessAccessKey) ||
    !value.expected.salesman_business_boards.every(isSalesmanBusinessBoard)
  ) {
    throw new Error("admin_people_invalid_input");
  }

  return {
    targetUserId:
      typeof value.targetUserId === "string" ? value.targetUserId : "",
    expected: {
      role: value.expected.role,
      status: value.expected.status,
      city: typeof value.expected.city === "string" ? value.expected.city : null,
      workspace_business_access: value.expected.workspace_business_access,
      salesman_business_boards: value.expected.salesman_business_boards,
    },
    nextRole: value.nextRole,
    nextStatus: value.nextStatus,
    nextCity: typeof value.nextCity === "string" ? value.nextCity : null,
    note: typeof value.note === "string" ? value.note : null,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
