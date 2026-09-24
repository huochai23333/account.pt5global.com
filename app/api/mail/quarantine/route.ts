import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import { quarantineMailThreads, queryMailQuarantine } from "@/lib/mail/mail-service";

import { mailApiError, readAuthenticatedMailJson } from "../_shared";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(await queryMailQuarantine(await requireMailIdentity(), {
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 40),
      customerEmail: url.searchParams.get("customerEmail") ?? undefined,
      refCode: url.searchParams.get("refCode") ?? undefined,
      assignedMemberId: url.searchParams.get("assignedMemberId") ?? undefined,
      startAt: url.searchParams.get("startAt") ?? undefined,
      endAt: url.searchParams.get("endAt") ?? undefined,
    }));
  } catch (error) { return mailApiError(error, "隔离邮件暂时无法读取。"); }
}

export async function POST(request: Request) {
  try {
    const { identity, body: input } = await readAuthenticatedMailJson<Parameters<typeof quarantineMailThreads>[1]>(request);
    return NextResponse.json(await quarantineMailThreads(identity, input));
  } catch (error) { return mailApiError(error, "邮件暂时无法移入隔离区。"); }
}
