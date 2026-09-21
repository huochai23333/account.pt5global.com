import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { deleteMailThread, getMailThread } from "@/lib/mail/mail-service";

import { mailApiError } from "../../_shared";

export async function GET(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    return NextResponse.json(await getMailThread(await requireMailIdentity(), threadId));
  } catch (error) { return mailApiError(error, "邮件详情暂时无法读取。"); }
}

export async function DELETE(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    return NextResponse.json(await deleteMailThread(await requireMailIdentity(), threadId));
  } catch (error) { return mailApiError(error, "邮件副本暂时无法删除。"); }
}
