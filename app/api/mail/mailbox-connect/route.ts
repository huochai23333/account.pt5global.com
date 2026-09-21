import { NextResponse, type NextRequest } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { createSharedMailboxConnectSession } from "@/lib/mail/mail-service";
import { getRequestPublicOrigin } from "@/lib/public-site-origin";

import { mailApiError } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const identity = await requireMailIdentity();
    const returnUrl = new URL("/admin/mail?connected=1", getRequestPublicOrigin(request)).toString();
    return NextResponse.json(await createSharedMailboxConnectSession(identity, returnUrl), { status: 201 });
  } catch (error) { return mailApiError(error, "暂时无法连接公司邮箱。"); }
}
