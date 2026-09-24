import { NextResponse } from "next/server";

import { assignMailThread } from "@/lib/mail/mail-service";

import { mailApiError, readAuthenticatedMailJson } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    const { identity, body } = await readAuthenticatedMailJson<{ assignedMemberId?: string; expectedVersion?: number; reason?: string }>(request);
    if (!body.assignedMemberId || !Number.isInteger(body.expectedVersion)) throw new Error("请刷新后重新选择接收人。");
    return NextResponse.json(await assignMailThread(identity, {
      threadId, assignedMemberId: body.assignedMemberId, expectedVersion: body.expectedVersion!, reason: body.reason,
    }));
  } catch (error) { return mailApiError(error, "邮件暂时无法转交。"); }
}
