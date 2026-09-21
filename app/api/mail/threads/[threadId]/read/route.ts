import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { markMailThreadRead } from "@/lib/mail/mail-service";

import { mailApiError } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    const body = await request.json() as { messageId?: string };
    if (!body.messageId) throw new Error("缺少已读位置。");
    return NextResponse.json(await markMailThreadRead(await requireMailIdentity(), threadId, body.messageId));
  } catch (error) { return mailApiError(error, "已读状态暂时无法保存。"); }
}
