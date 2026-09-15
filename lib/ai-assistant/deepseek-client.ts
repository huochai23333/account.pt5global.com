export type ChatCompletionMessageParam = {
  content: string;
  role: "assistant" | "system" | "user";
};

type DeepSeekStreamChoice = {
  delta?: {
    content?: unknown;
  };
};

type DeepSeekStreamChunk = {
  choices?: DeepSeekStreamChoice[];
};

type CreateDeepSeekAssistantStreamOptions = {
  messages: ChatCompletionMessageParam[];
  onCompleted?: (contentLength: number) => Promise<void>;
  onFailed?: (code: string) => Promise<void>;
  onSettled?: () => void;
  signal: AbortSignal;
  userId: string;
};

export class AiAssistantServiceError extends Error {
  code: "missingConfig" | "providerError";

  constructor(code: AiAssistantServiceError["code"]) {
    super(code);
    this.code = code;
  }
}

const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
const MAX_ASSISTANT_TOKENS = 700;

export async function createDeepSeekAssistantTextStream({
  messages,
  onCompleted,
  onFailed,
  onSettled,
  signal,
  userId,
}: CreateDeepSeekAssistantStreamOptions) {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();

  if (!apiKey) {
    throw new AiAssistantServiceError("missingConfig");
  }

  const response = await fetch(
    `${resolveDeepSeekBaseUrl()}/chat/completions`,
    {
      body: JSON.stringify({
        max_tokens: MAX_ASSISTANT_TOKENS,
        messages,
        model: process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL,
        stream: true,
        temperature: 0.2,
        thinking: {
          type: "disabled",
        },
        user_id: normalizeDeepSeekUserId(userId),
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal,
    },
  );

  if (!response.ok || !response.body) {
    throw new AiAssistantServiceError("providerError");
  }

  return createEventStreamFromDeepSeekSse(
    response.body,
    { onCompleted, onFailed, onSettled },
  );
}

function createEventStreamFromDeepSeekSse(
  body: ReadableStream<Uint8Array>,
  callbacks: Pick<
    CreateDeepSeekAssistantStreamOptions,
    "onCompleted" | "onFailed" | "onSettled"
  >,
) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  const reader = body.getReader();
  let settled = false;

  const settle = () => {
    if (settled) {
      return;
    }

    settled = true;
    callbacks.onSettled?.();
  };

  const enqueueEvent = (
    controller: ReadableStreamDefaultController<Uint8Array>,
    event: Record<string, unknown>,
  ) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let contentLength = 0;
      let hasMeaningfulContent = false;
      let completedByProvider = false;

      try {
        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          buffer = flushSseEvents(buffer, (event) => {
            if (event.type === "completed") {
              completedByProvider = true;
              return;
            }
            contentLength += event.text.length;
            hasMeaningfulContent ||= event.text.trim().length > 0;
            enqueueEvent(controller, event);
          });
        }

        buffer += decoder.decode();
        flushSseEvents(`${buffer}\n\n`, (event) => {
          if (event.type === "completed") {
            completedByProvider = true;
            return;
          }
          contentLength += event.text.length;
          hasMeaningfulContent ||= event.text.trim().length > 0;
          enqueueEvent(controller, event);
        });

        if (!completedByProvider || !hasMeaningfulContent) {
          throw new Error(completedByProvider ? "provider_empty_content" : "provider_stream_incomplete");
        }

        await callbacks.onCompleted?.(contentLength);
        enqueueEvent(controller, { type: "completed", contentLength });
        controller.close();
      } catch (error) {
        const code = error instanceof Error ? error.message : "provider_stream_error";
        try {
          await callbacks.onFailed?.(code);
          enqueueEvent(controller, { type: "error", code });
          controller.close();
        } catch {
          controller.error(new Error("operation_result_not_saved"));
        }
      } finally {
        reader.releaseLock();
        settle();
      }
    },
    async cancel() {
      await reader.cancel();
      settle();
    },
  });
}

type AssistantStreamEvent =
  | { type: "completed" }
  | { type: "delta"; text: string };

function flushSseEvents(buffer: string, onEvent: (event: AssistantStreamEvent) => void) {
  const events = buffer.split(/\r?\n\r?\n/);
  const remaining = events.pop() ?? "";

  for (const event of events) {
    const dataLines = event
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim());

    for (const data of dataLines) {
      if (!data) {
        continue;
      }

      if (data === "[DONE]") {
        onEvent({ type: "completed" });
        continue;
      }

      const text = extractDeltaContent(data);

      if (text) {
        onEvent({ type: "delta", text });
      }
    }
  }

  return remaining;
}

function extractDeltaContent(data: string) {
  try {
    const chunk = JSON.parse(data) as DeepSeekStreamChunk;
    const content = chunk.choices?.[0]?.delta?.content;

    return typeof content === "string" ? content : "";
  } catch {
    throw new Error("provider_stream_invalid_json");
  }
}

function resolveDeepSeekBaseUrl() {
  const value = process.env.DEEPSEEK_BASE_URL?.trim() || DEFAULT_DEEPSEEK_BASE_URL;

  return value.replace(/\/+$/, "");
}

function normalizeDeepSeekUserId(userId: string) {
  const normalized = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 96);

  return normalized ? `user_${normalized}` : undefined;
}
