import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import {
  createMailIntakeRule,
  deleteMailIntakeRule,
  listMailIntakeRules,
  updateMailIntakeRule,
} from "@/lib/mail/mail-service";
import type { MailIntakeRuleAction, MailIntakeRuleMatcher } from "@/lib/mail/mail-types";

import { mailApiError, readAuthenticatedMailJson } from "../_shared";

export async function GET() {
  try { return NextResponse.json(await listMailIntakeRules(await requireMailIdentity())); }
  catch (error) { return mailApiError(error, "收件规则暂时无法读取。"); }
}

export async function POST(request: Request) {
  try {
    const { identity, body: input } = await readAuthenticatedMailJson<{ matchType: MailIntakeRuleMatcher; action: MailIntakeRuleAction; pattern: string; enabled?: boolean }>(request);
    return NextResponse.json(await createMailIntakeRule(identity, input));
  } catch (error) { return mailApiError(error, "收件规则暂时无法创建。"); }
}

export async function PUT(request: Request) {
  try {
    const { identity, body: input } = await readAuthenticatedMailJson<{
      ruleId: string;
      matchType: MailIntakeRuleMatcher;
      action: MailIntakeRuleAction;
      pattern: string;
      enabled: boolean;
      expectedVersion: number;
    }>(request);
    return NextResponse.json(await updateMailIntakeRule(identity, input));
  } catch (error) { return mailApiError(error, "收件规则暂时无法保存。"); }
}

export async function DELETE(request: Request) {
  try {
    const { identity, body: input } = await readAuthenticatedMailJson<{ ruleId: string; expectedVersion: number }>(request);
    return NextResponse.json(await deleteMailIntakeRule(identity, input.ruleId, input.expectedVersion));
  } catch (error) { return mailApiError(error, "收件规则暂时无法删除。"); }
}
