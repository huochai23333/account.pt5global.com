import type { AiAssistantChatMessage, AiAssistantLocale } from "@/lib/ai-assistant/assistant-types";

import type { AiAssistantUiMessage } from "./ai-assistant-ui-types";

/**
 * 发给普通问答模型的历史只保留用户能读懂的业务摘要。
 * 确认请求 ID、客户 ID 等内部字段不会进入模型上下文，也不能被模型拿来执行发布。
 */
export function buildAiAssistantReadableHistory(
  messages: AiAssistantUiMessage[],
  locale: AiAssistantLocale,
): AiAssistantChatMessage[] {
  return messages
    .filter((message) => !message.intro)
    .map((message) => ({
      content: getReadableMessageContent(message, locale),
      role: message.role,
    }));
}

function getReadableMessageContent(message: AiAssistantUiMessage, locale: AiAssistantLocale) {
  const settlementRelease = message.settlementRelease;

  if (!settlementRelease) {
    return message.content;
  }

  const { action, state } = settlementRelease;
  const amount = new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(action.amount);
  const note = action.note
    ? locale === "en"
      ? `, note: ${action.note}`
      : `，备注：${action.note}`
    : "";

  if (locale === "en") {
    return `${message.content}\nSettlement summary: ${action.customerName}, ${amount} ${action.currency}, received on ${action.receivedOn}, status: ${getStateLabel(state, locale)}${note}.`;
  }

  return `${message.content}\n结汇摘要：${action.customerName}，${amount} ${action.currency}，收款日期 ${action.receivedOn}，状态：${getStateLabel(state, locale)}${note}。`;
}

function getStateLabel(
  state: NonNullable<AiAssistantUiMessage["settlementRelease"]>["state"],
  locale: AiAssistantLocale,
) {
  const labels =
    locale === "en"
      ? {
          cancelled: "cancelled",
          failed: "failed",
          published: "published",
          publishing: "publishing",
          ready: "waiting for confirmation",
        }
      : {
          cancelled: "已取消",
          failed: "发布失败",
          published: "已发布",
          publishing: "发布中",
          ready: "等待确认",
        };

  return labels[state];
}
