import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { getAdminMailMetrics } from "@/lib/mail/mail-admin-reporting";

import { mailApiError } from "../_shared";

export async function GET() {
  try { return NextResponse.json(await getAdminMailMetrics(await requireMailIdentity())); }
  catch (error) { return mailApiError(error, "运行状态暂时无法读取。"); }
}
