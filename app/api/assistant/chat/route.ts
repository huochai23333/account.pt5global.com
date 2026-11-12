import { getServerAuthContext } from "@/lib/server-auth";
import { RequestBodyTooLargeError } from "@/lib/server-request-body";
import { getServerSupabaseClient } from "@/lib/supabase-server";

import { createErrorResponse } from "./chat-error-response";
import { startAssistantGeneration } from "./chat-generation";
import { readAssistantChatInput, type NormalizedAssistantPayload } from "./chat-input";
import { buildSettlementResponse } from "./chat-settlement-response";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // 先核对可信的登录状态，再读取正文或调用任何业务服务。
  const { role, status, userId } = await getServerAuthContext();

  if (!userId || status !== "active") {
    return createErrorResponse("notSignedIn");
  }

  let payload: NormalizedAssistantPayload;
  try {
    payload = await readAssistantChatInput(request);
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return createErrorResponse("requestTooLarge");
    }

    return createErrorResponse("invalidInput");
  }

  const supabase = await getServerSupabaseClient();
  const settlementResponse = await buildSettlementResponse(supabase, payload.message, role);

  return settlementResponse ?? startAssistantGeneration({
    payload,
    requestSignal: request.signal,
    role,
    supabase,
    userId,
  });
}
