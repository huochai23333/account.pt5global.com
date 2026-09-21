import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { updateMailThreadState } from "@/lib/mail/mail-service";
import type { MailThreadState } from "@/lib/mail/mail-types";

import { mailApiError } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    const body = await request.json() as { state?: MailThreadState; expectedVersion?: number };
    if (!body.state || !["waiting_pt5", "waiting_customer", "closed"].includes(body.state) || !Number.isInteger(body.expectedVersion)) {
      throw new Error("请刷新后重新选择会话状态。");
    }
    return NextResponse.json(await updateMailThreadState(await requireMailIdentity(), {
      threadId, state: body.state, expectedVersion: body.expectedVersion!,
    }));
  } catch (error) { return mailApiError(error, "会话状态暂时无法更新。"); }
}
