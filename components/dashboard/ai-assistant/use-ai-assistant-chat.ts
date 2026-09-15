"use client";

import { useCallback, useMemo, useState } from "react";

import type {
  AiAssistantChatRequest,
  AiAssistantLocale,
  AiAssistantStructuredResponse,
} from "@/lib/ai-assistant/assistant-types";
import { readAssistantEventStream } from "@/lib/ai-assistant/assistant-event-stream";

import type {
  AiAssistantSettlementReleaseCopy,
  AiAssistantUiMessage,
} from "./ai-assistant-ui-types";
import { buildAiAssistantReadableHistory } from "./ai-assistant-history";
import { readAssistantStructuredResponse } from "./ai-assistant-response";
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

  const reset = useCallback(() => {
    if (actionPending) {
      return;
    }

    setMessages([introMessage]);
    setInput("");
    setErrorMessage(null);
    setPending(false);
  }, [actionPending, introMessage]);

  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim();

    if (!trimmedInput || busy) {
      return;
    }

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
      const requestBody: AiAssistantChatRequest = {
        history,
        locale,
        message: trimmedInput,
        pathname,
        requestId: assistantMessageId,
      };
      const response = await fetch("/api/assistant/chat", {
        body: JSON.stringify(requestBody),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        const errorCode = await readAssistantErrorCode(response);
        throw new AiAssistantRequestError(errorCode);
      }

      if (response.headers.get("content-type")?.includes("application/json")) {
        const structuredResponse = await readAssistantStructuredResponse(response);

        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId
              ? buildStructuredMessage(item, structuredResponse, copy)
              : item,
          ),
        );
        return;
      }

      if (!response.body) {
        throw new Error("assistant unavailable");
      }

      await readAssistantEventStream(response.body, (chunk) => {
        setMessages((current) =>
          current.map((item) =>
            item.id === assistantMessageId
              ? {
                  ...item,
                  content: `${item.content}${chunk}`,
                }
              : item,
          ),
        );
      });
    } catch (error) {
      setMessages((current) =>
        current.filter((item) => item.id !== assistantMessageId),
      );
      setErrorMessage(getAssistantErrorMessage(error, copy));
    } finally {
      setPending(false);
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

class AiAssistantRequestError extends Error {
  constructor(public code: string | null) {
    super(code ?? "assistant unavailable");
  }
}

async function readAssistantErrorCode(response: Response) {
  try {
    const body = (await response.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

function buildStructuredMessage(
  message: AiAssistantUiMessage,
  response: AiAssistantStructuredResponse,
  copy: AiAssistantChatCopy,
): AiAssistantUiMessage {
  if (response.kind === "settlementReleaseGuidance") {
    return {
      ...message,
      content: copy.settlementRelease.guidance[response.code],
    };
  }

  return {
    ...message,
    content: copy.settlementRelease.confirmationIntro,
    settlementRelease: {
      action: response.action,
      state: "ready",
    },
  };
}

function getAssistantErrorMessage(
  error: unknown,
  copy: AiAssistantChatCopy,
) {
  if (error instanceof AiAssistantRequestError) {
    if (error.code === "tooManyRequests") {
      return copy.tooManyRequests;
    }

    if (error.code === "requestTooLarge") {
      return copy.requestTooLarge;
    }

    if (error.code === "resultConfirming") {
      return copy.resultConfirming;
    }
  }

  return copy.serviceUnavailable;
}

function createMessageId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
