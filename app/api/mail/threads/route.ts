import { NextResponse } from "next/server";

import { queryMailThreads } from "@/lib/mail/mail-service";
import type { MailThreadQuery } from "@/lib/mail/mail-types";

import { mailApiError, readAuthenticatedMailJson } from "../_shared";

export async function POST(request: Request) {
  try {
    const { identity, body: filters } = await readAuthenticatedMailJson<MailThreadQuery>(request);
    return NextResponse.json(await queryMailThreads(identity, filters));
  } catch (error) { return mailApiError(error, "邮件列表暂时无法读取。"); }
}
