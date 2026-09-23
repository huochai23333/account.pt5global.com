import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { getOutboundStatus } from "@/lib/mail/mail-outbound-service";

import { mailApiError } from "../../_shared";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    return NextResponse.json(await getOutboundStatus(await requireMailIdentity(), jobId));
  } catch (error) { return mailApiError(error, "发送状态暂时无法确认。"); }
}
