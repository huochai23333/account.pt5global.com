import { NextResponse } from "next/server";

import { markMailThreadRead } from "@/lib/mail/mail-service";

import { mailApiError, readAuthenticatedMailJson } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    const { identity, body } = await readAuthenticatedMailJson<{ messageId?: string }>(request);
    if (!body.messageId) throw new Error("缺少已读位置。");
    return NextResponse.json(await markMailThreadRead(identity, threadId, body.messageId));
  } catch (error) { return mailApiError(error, "已读状态暂时无法保存。"); }
}
