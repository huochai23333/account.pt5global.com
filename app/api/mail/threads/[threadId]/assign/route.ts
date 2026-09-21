import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { assignMailThread } from "@/lib/mail/mail-service";

import { mailApiError } from "../../../_shared";

export async function POST(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    const body = await request.json() as { assignedMemberId?: string; expectedVersion?: number; reason?: string };
    if (!body.assignedMemberId || !Number.isInteger(body.expectedVersion)) throw new Error("请刷新后重新选择接收人。");
    return NextResponse.json(await assignMailThread(await requireMailIdentity(), {
      threadId, assignedMemberId: body.assignedMemberId, expectedVersion: body.expectedVersion!, reason: body.reason,
    }));
  } catch (error) { return mailApiError(error, "邮件暂时无法转交。"); }
}
