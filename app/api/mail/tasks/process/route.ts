import { NextResponse } from "next/server";

import { processMailQueues } from "@/lib/mail/mail-worker";

export const maxDuration = 60;

export async function POST(request: Request) {
  const expected = process.env.MAIL_TASK_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  if (!expected || authorization !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "后台任务身份无效。" }, { status: 401 });
  }
  try {
    return NextResponse.json(await processMailQueues());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "邮件后台任务暂时无法完成。" },
      { status: 500 },
    );
  }
}
