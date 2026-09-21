import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { listMailAgents, updateMailAgentProfile } from "@/lib/mail/mail-service";
import type { MailAgentProfile } from "@/lib/mail/mail-types";

import { mailApiError } from "../_shared";

export async function GET() {
  try { return NextResponse.json(await listMailAgents(await requireMailIdentity())); }
  catch (error) { return mailApiError(error, "人员配置暂时无法读取。"); }
}

export async function PUT(request: Request) {
  try {
    const profile = await request.json() as Omit<MailAgentProfile, "displayName" | "feishuBound">;
    return NextResponse.json(await updateMailAgentProfile(await requireMailIdentity(), profile));
  } catch (error) { return mailApiError(error, "人员配置暂时无法保存。"); }
}
