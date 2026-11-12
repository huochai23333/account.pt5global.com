import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { getMailThread } from "@/lib/mail/mail-service";
import { deleteMailThread } from "@/lib/mail/mail-admin-deletion";
import { assertThreadAccess, MailThreadUnavailableError } from "@/lib/mail/mail-thread-access";

import { mailApiError } from "../../_shared";

export async function GET(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    return NextResponse.json(await getMailThread(await requireMailIdentity(), threadId));
  } catch (error) {
    if (error instanceof MailThreadUnavailableError) {
      return NextResponse.json({ error: error.message, code: "thread_unavailable" }, { status: 400 });
    }
    return mailApiError(error, "邮件详情暂时无法读取。");
  }
}

export async function HEAD(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  const headers = { "Cache-Control": "private, no-store" };
  try {
    const { threadId } = await context.params;
    // 页面仅核对打开的会话，无需解密正文或读写已读位置。
    await assertThreadAccess(await requireMailIdentity(), threadId);
    return new Response(null, { status: 204, headers });
  } catch (error) {
    if (error instanceof MailThreadUnavailableError) return new Response(null, { status: 404, headers });
    const { status } = mailApiError(error, "邮件会话权限暂时无法确认。");
    return new Response(null, { status: status === 401 ? 401 : 503, headers });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ threadId: string }> }) {
  try {
    const { threadId } = await context.params;
    return NextResponse.json(await deleteMailThread(await requireMailIdentity(), threadId));
  } catch (error) { return mailApiError(error, "邮件副本暂时无法删除。"); }
}
