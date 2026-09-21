import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { queryMailThreads } from "@/lib/mail/mail-service";
import type { MailThreadQuery } from "@/lib/mail/mail-types";

import { mailApiError } from "../_shared";

export async function POST(request: Request) {
  try {
    const filters = await request.json() as MailThreadQuery;
    return NextResponse.json(await queryMailThreads(await requireMailIdentity(), filters));
  } catch (error) { return mailApiError(error, "邮件列表暂时无法读取。"); }
}
