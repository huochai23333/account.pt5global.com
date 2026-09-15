type AssistantEvent =
  | { type: "completed"; contentLength: number }
  | { type: "delta"; text: string }
  | { type: "error"; code: string };

/**
 * 客户端只有读到 completed 终态并确认正文非空，才把回答留在对话中。
 * 连接正常关闭、收到几个空片段或 HTTP 200 都不再被当成生成成功。
 */
export async function readAssistantEventStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void,
) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  let content = "";

  const consumeLines = (flush = false) => {
    const lines = buffer.split("\n");
    buffer = flush ? "" : (lines.pop() ?? "");
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;
      const event = parseAssistantEvent(line);
      if (completed) throw new Error("assistant_event_after_completed");
      if (event.type === "error") throw new Error(event.code);
      if (event.type === "completed") {
        if (event.contentLength !== content.length) {
          throw new Error("assistant_content_length_mismatch");
        }
        completed = true;
        continue;
      }
      content += event.text;
      onDelta(event.text);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    consumeLines();
  }
  buffer += decoder.decode();
  if (buffer.trim()) buffer += "\n";
  consumeLines(true);

  if (!completed || !content.trim()) {
    throw new Error("assistant_stream_incomplete");
  }

  return content;
}

function parseAssistantEvent(line: string): AssistantEvent {
  const value = JSON.parse(line) as Record<string, unknown>;
  if (value.type === "delta" && typeof value.text === "string") {
    return { type: "delta", text: value.text };
  }
  if (value.type === "completed" && typeof value.contentLength === "number") {
    return { type: "completed", contentLength: value.contentLength };
  }
  if (value.type === "error" && typeof value.code === "string") {
    return { type: "error", code: value.code };
  }
  throw new Error("assistant_event_invalid");
}
