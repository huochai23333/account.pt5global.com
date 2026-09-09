import { NextResponse } from "next/server";

import { createEmailConnectSession } from "@/lib/emailconnect/emailconnect-client";
import { requireEmailConnectIdentity } from "@/lib/emailconnect/emailconnect-identity";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { workspace?: string };
    if (!input.workspace) throw new Error("缺少当前工作台信息。");
    const identity = await requireEmailConnectIdentity(input.workspace);
    const returnUrl = new URL("/email-reminders?connected=1", request.url).toString();
    return NextResponse.json(await createEmailConnectSession(identity, returnUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : "暂时无法开始连接。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
