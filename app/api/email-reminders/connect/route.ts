import { NextResponse, type NextRequest } from "next/server";

import { createEmailConnectSession } from "@/lib/emailconnect/emailconnect-client";
import { requireEmailConnectIdentity } from "@/lib/emailconnect/emailconnect-identity";
import { getRequestPublicOrigin } from "@/lib/public-site-origin";

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as { workspace?: string };
    if (!input.workspace) throw new Error("缺少当前工作台信息。");
    const identity = await requireEmailConnectIdentity(input.workspace);
    // 托管平台会把内部 Node 地址写进 request.url，回调必须使用经过白名单校验的公开站点 origin。
    const returnUrl = new URL(
      "/email-reminders?connected=1",
      getRequestPublicOrigin(request),
    ).toString();
    return NextResponse.json(await createEmailConnectSession(identity, returnUrl));
  } catch (error) {
    const message = error instanceof Error ? error.message : "暂时无法开始连接。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
