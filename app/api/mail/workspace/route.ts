import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { getMailWorkspace } from "@/lib/mail/mail-service";

import { mailApiError } from "../_shared";

export async function GET() {
  try { return NextResponse.json(await getMailWorkspace(await requireMailIdentity())); }
  catch (error) { return mailApiError(error, "公司邮箱状态暂时无法读取。"); }
}
