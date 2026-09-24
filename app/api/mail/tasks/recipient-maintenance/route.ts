import { NextResponse } from "next/server";
import { readLimitedJsonBody, RequestBodyTooLargeError } from "@/lib/server-request-body";

import {
  backfillOutboundRecipientHistory,
  previewUnknownHistoricalThreads,
  purgeUnknownHistoricalThreads,
} from "@/lib/mail/mail-recipient-maintenance";

export const maxDuration = 60;

function isAuthorized(request: Request) {
  const expected = process.env.MAIL_TASK_SECRET?.trim();
  return Boolean(expected) && request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "后台任务身份无效。" }, { status: 401 });
  }
  try {
    const body = await readLimitedJsonBody(request, 16 * 1024) as { action?: unknown; confirmationToken?: unknown };
    if (body.action === "prepare") {
      const backfill = await backfillOutboundRecipientHistory();
      const preview = await previewUnknownHistoricalThreads();
      return NextResponse.json({ status: "prepared", backfill, preview });
    }
    if (body.action === "purge") {
      const confirmationToken = typeof body.confirmationToken === "string" ? body.confirmationToken : "";
      return NextResponse.json(await purgeUnknownHistoricalThreads(confirmationToken));
    }
    return NextResponse.json({ error: "请选择正确的历史邮件维护操作。" }, { status: 400 });
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) return NextResponse.json({ error: "提交内容太大，请缩小后重试。" }, { status: 413 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "提交内容无法读取，请检查后重试。" }, { status: 400 });
    return NextResponse.json(
      { error: "历史邮件维护暂时无法完成。" },
      { status: 500 },
    );
  }
}
