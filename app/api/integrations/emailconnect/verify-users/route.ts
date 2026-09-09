import { NextResponse } from "next/server";

import { verifyEmailConnectRequest } from "@/lib/emailconnect/emailconnect-host-verification";
import { verifyEmailConnectUsers } from "@/lib/emailconnect/emailconnect-user-verification";

export async function POST(request: Request) {
  const body = await request.text();
  try {
    verifyEmailConnectRequest(request, body);
    const input = JSON.parse(body) as { externalUserIds?: string[] };
    if (!Array.isArray(input.externalUserIds) || input.externalUserIds.length === 0) {
      throw new Error("缺少需要确认的人员。");
    }
    return NextResponse.json({ users: await verifyEmailConnectUsers(input.externalUserIds) });
  } catch (error) {
    console.error("EmailConnect 人员验证失败", error);
    return NextResponse.json({ error: "人员状态暂时无法确认。" }, { status: 401 });
  }
}
