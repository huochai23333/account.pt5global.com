import { NextResponse } from "next/server";

import { requireMailIdentity, requireMailAdministrator } from "@/lib/mail/mail-identity";
import { getMailThread, restoreMailThread } from "@/lib/mail/mail-service";

import { mailApiError } from "../../_shared";

export async function GET(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const identity = await requireMailIdentity();
    requireMailAdministrator(identity);
    const { threadId } = await context.params;
    return NextResponse.json(await getMailThread(identity, threadId, { includeQuarantined: true }));
  } catch (error) { return mailApiError(error, "隔离邮件暂时无法读取。"); }
}

export async function PATCH(request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    const input = await request.json() as { expectedVersion: number };
    return NextResponse.json(await restoreMailThread(await requireMailIdentity(), threadId, input.expectedVersion));
  } catch (error) { return mailApiError(error, "隔离邮件暂时无法恢复。"); }
}
