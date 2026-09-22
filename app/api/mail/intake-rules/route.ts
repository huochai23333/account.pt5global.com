import { NextResponse } from "next/server";

import { requireMailIdentity } from "@/lib/mail/mail-identity";
import {
  createMailIntakeRule,
  deleteMailIntakeRule,
  listMailIntakeRules,
  updateMailIntakeRule,
} from "@/lib/mail/mail-service";
import type { MailIntakeRuleAction, MailIntakeRuleMatcher } from "@/lib/mail/mail-types";

import { mailApiError } from "../_shared";

export async function GET() {
  try { return NextResponse.json(await listMailIntakeRules(await requireMailIdentity())); }
  catch (error) { return mailApiError(error, "收件规则暂时无法读取。"); }
}

export async function POST(request: Request) {
  try {
    const input = await request.json() as { matchType: MailIntakeRuleMatcher; action: MailIntakeRuleAction; pattern: string; enabled?: boolean };
    return NextResponse.json(await createMailIntakeRule(await requireMailIdentity(), input));
  } catch (error) { return mailApiError(error, "收件规则暂时无法创建。"); }
}

export async function PUT(request: Request) {
  try {
    const input = await request.json() as {
      ruleId: string;
      matchType: MailIntakeRuleMatcher;
      action: MailIntakeRuleAction;
      pattern: string;
      enabled: boolean;
      expectedVersion: number;
    };
    return NextResponse.json(await updateMailIntakeRule(await requireMailIdentity(), input));
  } catch (error) { return mailApiError(error, "收件规则暂时无法保存。"); }
}

export async function DELETE(request: Request) {
  try {
    const input = await request.json() as { ruleId: string; expectedVersion: number };
    return NextResponse.json(await deleteMailIntakeRule(await requireMailIdentity(), input.ruleId, input.expectedVersion));
  } catch (error) { return mailApiError(error, "收件规则暂时无法删除。"); }
}
