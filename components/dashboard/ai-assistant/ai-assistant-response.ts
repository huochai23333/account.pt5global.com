import type {
  AiAssistantSettlementReleaseAction,
  AiAssistantSettlementReleaseGuidanceCode,
  AiAssistantStructuredResponse,
} from "@/lib/ai-assistant/assistant-types";

import type { AiAssistantSettlementReleaseCopy, AiAssistantUiMessage } from "./ai-assistant-ui-types";

/** 浏览器只接受助手接口声明过的结构，异常 JSON 不会被渲染成可确认的财务动作。 */
export async function readAssistantStructuredResponse(response: Response) {
  const value = (await response.json()) as unknown;

  if (!isStructuredResponse(value)) {
    throw new Error("assistant unavailable");
  }

  return value;
}

function isStructuredResponse(
  value: unknown,
): value is AiAssistantStructuredResponse {
  if (!isRecord(value)) {
    return false;
  }

  if (value.kind === "settlementReleaseGuidance") {
    return isSettlementReleaseGuidanceCode(value.code);
  }

  return (
    value.kind === "settlementReleaseConfirmation" &&
    isSettlementReleaseAction(value.action)
  );
}

function isSettlementReleaseAction(
  value: unknown,
): value is AiAssistantSettlementReleaseAction {
  return (
    isRecord(value) &&
    typeof value.amount === "number" &&
    typeof value.currency === "string" &&
    (typeof value.customerId === "string" || value.customerId === null) &&
    (value.customerKind === "existing" || value.customerKind === "temporary") &&
    typeof value.customerName === "string" &&
    typeof value.inputCustomerName === "string" &&
    (typeof value.note === "string" || value.note === null) &&
    typeof value.receivedOn === "string" &&
    typeof value.requestId === "string"
  );
}

function isSettlementReleaseGuidanceCode(
  value: unknown,
): value is AiAssistantSettlementReleaseGuidanceCode {
  return [
    "ambiguousCustomer",
    "invalidAmount",
    "invalidCurrency",
    "invalidDate",
    "missingAmount",
    "missingCurrency",
    "missingCustomer",
    "multipleAmounts",
    "notAllowed",
  ].includes(String(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// 校验通过后才把结构化结果交给消息气泡或确认按钮。
export function buildStructuredMessage(
  message: AiAssistantUiMessage,
  response: AiAssistantStructuredResponse,
  copy: AiAssistantSettlementReleaseCopy,
): AiAssistantUiMessage {
  if (response.kind === "settlementReleaseGuidance") {
    return {
      ...message,
      content: copy.guidance[response.code],
    };
  }

  return {
    ...message,
    content: copy.confirmationIntro,
    settlementRelease: {
      action: response.action,
      state: "ready",
    },
  };
}
