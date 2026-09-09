import { NextResponse } from "next/server";

import { disconnectEmailConnection } from "@/lib/emailconnect/emailconnect-client";
import { requireEmailConnectIdentity } from "@/lib/emailconnect/emailconnect-identity";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ connectionId: string }> },
) {
  try {
    const input = (await request.json()) as { workspace?: string };
    if (!input.workspace) throw new Error("缺少当前工作台信息。");
    const identity = await requireEmailConnectIdentity(input.workspace);
    const { connectionId } = await context.params;
    await disconnectEmailConnection(identity.externalUserId, connectionId);
    return NextResponse.json({ disconnected: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "暂时无法断开邮箱。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
