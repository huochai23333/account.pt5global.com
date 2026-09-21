import { NextResponse, type NextRequest } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { createFeishuConnectSession } from "@/lib/mail/mail-service";
import { getRequestPublicOrigin } from "@/lib/public-site-origin";

import { mailApiError } from "../_shared";

export async function POST(request: NextRequest) {
  try {
    const identity = await requireMailIdentity();
    const workspace = identity.role === "administrator" ? "admin" : "salesman";
    const returnUrl = new URL(`/${workspace}/mail?feishu=connected`, getRequestPublicOrigin(request)).toString();
    return NextResponse.json(await createFeishuConnectSession(identity, returnUrl), { status: 201 });
  } catch (error) { return mailApiError(error, "暂时无法绑定飞书。"); }
}
