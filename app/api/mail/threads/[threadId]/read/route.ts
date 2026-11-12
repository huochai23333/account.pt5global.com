import { NextResponse } from "next/server";

import { markMailThreadRead } from "@/lib/mail/mail-thread-mutations";

import { mailApiError, readAuthenticatedMailJson } from "../../../_shared";

/** 只确认页面实际打开的来信；回执中的未读状态包含事务已看到的更新来信。 */
export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    const { identity, body } = await readAuthenticatedMailJson<{ messageId?: string }>(request);
    if (!body.messageId) throw new Error("缺少已读位置。");
    return NextResponse.json(await markMailThreadRead(identity, threadId, body.messageId));
  } catch (error) { return mailApiError(error, "已读状态暂时无法保存。"); }
}
