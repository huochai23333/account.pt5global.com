import assert from "node:assert/strict";
import test from "node:test";

import { readAssistantEventStream } from "../lib/ai-assistant/assistant-event-stream.ts";

function streamFrom(text) {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

test("仅完整正文和 completed 终态可以成功", async () => {
  const chunks = [];
  const content = await readAssistantEventStream(
    streamFrom('{"type":"delta","text":"可以"}\n{"type":"completed","contentLength":2}\n'),
    (chunk) => chunks.push(chunk),
  );

  assert.equal(content, "可以");
  assert.deepEqual(chunks, ["可以"]);
});

test("连接结束但缺少 completed 时失败", async () => {
  await assert.rejects(
    readAssistantEventStream(
      streamFrom('{"type":"delta","text":"未完成"}\n'),
      () => {},
    ),
    /assistant_stream_incomplete/,
  );
});

test("空正文即使有 completed 也失败", async () => {
  await assert.rejects(
    readAssistantEventStream(
      streamFrom('{"type":"completed","contentLength":0}\n'),
      () => {},
    ),
    /assistant_stream_incomplete/,
  );
});

test("错误事件和终态之后的多余内容都失败", async () => {
  await assert.rejects(
    readAssistantEventStream(
      streamFrom('{"type":"error","code":"provider_failed"}\n'),
      () => {},
    ),
    /provider_failed/,
  );

  await assert.rejects(
    readAssistantEventStream(
      streamFrom('{"type":"delta","text":"好"}\n{"type":"completed","contentLength":1}\n{"type":"delta","text":"坏"}\n'),
      () => {},
    ),
    /assistant_event_after_completed/,
  );
});
