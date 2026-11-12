"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  AiAssistantLocale,
} from "@/lib/ai-assistant/assistant-types";

import type {
  AiAssistantSettlementReleaseCopy,
  AiAssistantUiMessage,
} from "./ai-assistant-ui-types";
import { buildAiAssistantReadableHistory } from "./ai-assistant-history";
import { getAssistantErrorMessage, requestAssistantReply } from "./ai-assistant-request";
import { buildStructuredMessage } from "./ai-assistant-response";
import { useAiAssistantSettlementRelease } from "./use-ai-assistant-settlement-release";

export type { AiAssistantUiMessage } from "./ai-assistant-ui-types";

type AiAssistantChatCopy = {
  greeting: string;
  requestTooLarge: string;
  resultConfirming: string;
  serviceUnavailable: string;
  settlementRelease: AiAssistantSettlementReleaseCopy;
  tooManyRequests: string;
};

type UseAiAssistantChatOptions = {
  copy: AiAssistantChatCopy;
  locale: AiAssistantLocale;
  pathname: string;
};

export function useAiAssistantChat({
  copy,
  locale,
  pathname,
}: UseAiAssistantChatOptions) {
  const introMessage = useMemo<AiAssistantUiMessage>(
    () => ({
      content: copy.greeting,
      id: "assistant-intro",
      intro: true,
      role: "assistant",
    }),
    [copy.greeting],
  );
  const [messages, setMessages] = useState<AiAssistantUiMessage[]>([
    introMessage,
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const {
    actionPending,
    cancelSettlementRelease,
    confirmSettlementRelease,
  } = useAiAssistantSettlementRelease({
    copy: copy.settlementRelease,
    messages,
    setMessages,
  });
  const busy = pending || actionPending;
  const activeRequest = useRef<AbortController | null>(null);

  // 关闭气泡时组件仍在，保留对话。离开工作台时停止网络读取。
  useEffect(() => () => activeRequest.current?.abort(), []);

  const reset = useCallback(() => {
    if (actionPending || activeRequest.current) {
      return;
    }

    setMessages([introMessage]);
    setInput("");
    setErrorMessage(null);
    setPending(false);
  }, [actionPending, introMessage]);

  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim();

    if (!trimmedInput || busy || activeRequest.current) {
      return;
    }

    // React 的按钮禁用要等下一次渲染，同一帧的第二次提交由这个引用拦住。
    const request = new AbortController();
    activeRequest.current = request;
    const history = buildAiAssistantReadableHistory(messages, locale);
    const userMessage: AiAssistantUiMessage = {
      content: trimmedInput,
      id: createMessageId("user"),
      role: "user",
    };
    const assistantMessageId = createMessageId("assistant");
    const assistantMessage: AiAssistantUiMessage = {
      content: "",
      id: assistantMessageId,
      role: "assistant",
    };

    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
    setErrorMessage(null);
    setPending(true);

    try {
      const structuredResponse = await requestAssistantReply(
        { history, locale, message: trimmedInput, pathname, requestId: assistantMessageId },
        request.signal,
        (chunk) => {
          setMessages((current) =>
            current.map((item) =>
              item.id === assistantMessageId
                ? { ...item, content: item.content + chunk }
                : item,
            ),
          );
        },
      );

      if (structuredResponse && !request.signal.aborted) {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId
              ? buildStructuredMessage(item, structuredResponse, copy.settlementRelease)
              : item,
          ),
        );
      }
    } catch (error) {
      if (request.signal.aborted) return;

      setMessages((current) =>
        current.filter((item) => item.id !== assistantMessageId),
      );
      setErrorMessage(getAssistantErrorMessage(error, copy));
    } finally {
      activeRequest.current = null;
      if (!request.signal.aborted) setPending(false);
    }
  }, [
    copy,
    busy,
    input,
    locale,
    messages,
    pathname,
  ]);

  return {
    busy,
    cancelSettlementRelease,
    confirmSettlementRelease,
    errorMessage,
    input,
    messages,
    pending,
    reset,
    sendMessage,
    setInput,
  };
}

function createMessageId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
