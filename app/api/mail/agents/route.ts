import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { getMailAgentProfile, listMailAgents, updateMailAgentProfile } from "@/lib/mail/mail-service";
import type { MailAgentProfile } from "@/lib/mail/mail-types";

import { mailApiError, readAuthenticatedMailJson } from "../_shared";

export async function GET() {
  try {
    const identity = await requireMailIdentity();
    return NextResponse.json(identity.role === "administrator"
      ? await listMailAgents(identity)
      : { agents: [await getMailAgentProfile(identity)] });
  }
  catch (error) { return mailApiError(error, "人员配置暂时无法读取。"); }
}

export async function PUT(request: Request) {
  try {
    const { identity, body: profile } = await readAuthenticatedMailJson<Omit<MailAgentProfile, "displayName" | "role" | "feishuBound" | "suggestedAliasLocalPart" | "suggestedRefPrefix"> & { resetToGenerated?: boolean }>(request);
    return NextResponse.json(await updateMailAgentProfile(identity, profile));
  } catch (error) { return mailApiError(error, "人员配置暂时无法保存。"); }
}
