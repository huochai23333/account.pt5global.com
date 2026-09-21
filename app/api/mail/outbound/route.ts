import { after, NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { createOutboundMessage } from "@/lib/mail/mail-service";
import { processOutboundJobBatch } from "@/lib/mail/mail-outbound-worker";
import type { OutboundMessageInput } from "@/lib/mail/mail-types";

import { mailApiError } from "../_shared";

export async function POST(request: Request) {
  try {
    const message = await request.json() as OutboundMessageInput;
    const receipt = await createOutboundMessage(await requireMailIdentity(), message);
    if (receipt.created) after(() => processOutboundJobBatch());
    return NextResponse.json(receipt, { status: 202 });
  } catch (error) { return mailApiError(error, "邮件暂时无法提交发送。"); }
}
