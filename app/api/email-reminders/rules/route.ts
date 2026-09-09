import { NextResponse } from "next/server";

import {
  getEmailPlatformRules,
  updateEmailPlatformRules,
} from "@/lib/emailconnect/emailconnect-client";
import { requireEmailConnectIdentity } from "@/lib/emailconnect/emailconnect-identity";
import type { EmailPlatformRule } from "@/lib/emailconnect/emailconnect-types";

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as { workspace?: string };
    if (!input.workspace) throw new Error("缺少当前工作台信息。");
    const identity = await requireEmailConnectIdentity(input.workspace);
    return NextResponse.json(await getEmailPlatformRules(identity));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "规则暂时无法读取。" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const input = (await request.json()) as { workspace?: string; rules?: EmailPlatformRule[] };
    if (!input.workspace || !Array.isArray(input.rules)) throw new Error("规则内容不完整。");
    const identity = await requireEmailConnectIdentity(input.workspace);
    return NextResponse.json(await updateEmailPlatformRules(identity, input.rules));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "规则暂时无法保存。" }, { status: 400 });
  }
}
