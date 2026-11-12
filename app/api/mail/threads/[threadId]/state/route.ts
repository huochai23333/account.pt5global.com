import { NextResponse } from "next/server";

import { updateMailThreadState } from "@/lib/mail/mail-thread-mutations";
import type { MailThreadState } from "@/lib/mail/mail-types";

import { mailApiError, readAuthenticatedMailJson } from "../../../_shared";

/** 接口只接收三种工作状态，最终版本由写入服务读回确认。 */
export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    const { identity, body } = await readAuthenticatedMailJson<{ state?: MailThreadState; expectedVersion?: number }>(request);
    if (!body.state || !["waiting_pt5", "waiting_customer", "closed"].includes(body.state) || !Number.isInteger(body.expectedVersion)) {
      throw new Error("请刷新后重新选择会话状态。");
    }
    return NextResponse.json(await updateMailThreadState(identity, {
      threadId, state: body.state, expectedVersion: body.expectedVersion!,
    }));
  } catch (error) { return mailApiError(error, "会话状态暂时无法更新。"); }
}
