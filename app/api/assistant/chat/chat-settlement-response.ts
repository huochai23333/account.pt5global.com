import { NextResponse } from "next/server";

import type { AiAssistantStructuredResponse } from "@/lib/ai-assistant/assistant-types";
import { parseSettlementReleaseCommand } from "@/lib/ai-assistant/settlement-release-command";
import { buildSettlementReleaseConfirmation } from "@/lib/ai-assistant/settlement-release-server";
import type { getServerAuthContext } from "@/lib/server-auth";
import type { getServerSupabaseClient } from "@/lib/supabase-server";

import { createErrorResponse } from "./chat-error-response";

// 明确的结汇指令走站内权限和客户查询，只准备确认资料，不把业务输入交给模型。
export async function buildSettlementResponse(
  supabase: Awaited<ReturnType<typeof getServerSupabaseClient>>,
  message: string,
  role: Awaited<ReturnType<typeof getServerAuthContext>>["role"],
) {
  const parsed = parseSettlementReleaseCommand(message);

  if (parsed.kind === "notCommand") {
    return null;
  }

  if (parsed.kind === "guidance") {
    return NextResponse.json<AiAssistantStructuredResponse>({
      code: parsed.code,
      kind: "settlementReleaseGuidance",
    });
  }

  if (role !== "administrator" && role !== "finance") {
    return NextResponse.json<AiAssistantStructuredResponse>({
      code: "notAllowed",
      kind: "settlementReleaseGuidance",
    });
  }

  try {
    const confirmation = await buildSettlementReleaseConfirmation(
      supabase,
      parsed.value,
    );

    if (confirmation.kind === "ambiguousCustomer") {
      return NextResponse.json<AiAssistantStructuredResponse>({
        code: "ambiguousCustomer",
        kind: "settlementReleaseGuidance",
      });
    }

    return NextResponse.json<AiAssistantStructuredResponse>({
      action: confirmation.action,
      kind: "settlementReleaseConfirmation",
    });
  } catch {
    return createErrorResponse("serviceUnavailable");
  }
}
