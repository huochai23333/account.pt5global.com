import { after, NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { createOutboundMessage, findOutboundJobByKey } from "@/lib/mail/mail-outbound-service";
import { processOutboundJobBatch } from "@/lib/mail/mail-outbound-worker";
import type { OutboundMessageInput } from "@/lib/mail/mail-types";
import { readLimitedJsonBody } from "@/lib/server-request-body";

import { mailApiError } from "../_shared";

export async function GET(request: Request) {
  try {
    const identity = await requireMailIdentity();
    const key = new URL(request.url).searchParams.get("key") ?? "";
    return NextResponse.json(await findOutboundJobByKey(identity, key));
  } catch (error) { return mailApiError(error, "发送状态暂时无法确认。"); }
}

export async function POST(request: Request) {
  try {
    // 发件正文有独立的体积上限，先鉴权再读取请求体。
    const identity = await requireMailIdentity();
    const message = await readLimitedJsonBody(request, 256 * 1024) as OutboundMessageInput;
    const receipt = await createOutboundMessage(identity, message);
    if (receipt.created) after(() => processOutboundJobBatch());
    return NextResponse.json(receipt, { status: 202 });
  } catch (error) { return mailApiError(error, "邮件暂时无法提交发送。"); }
}
