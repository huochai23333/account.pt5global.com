import assert from "node:assert/strict";
import test from "node:test";

import { readAssistantEventStream } from "../lib/ai-assistant/assistant-event-stream.ts";
import { createDeepSeekAssistantTextStream } from "../lib/ai-assistant/deepseek-client.ts";

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

// 网络可以在多字节字符或JSON行的任意字节处拆包；预期内容是固定文本，不从解析器计算。
test("byte-fragmented UTF-8 deltas preserve Chinese and emoji including an unterminated final line", async () => {
  const bytes = new TextEncoder().encode("{\"type\":\"delta\",\"text\":\"你🌍\"}\n{\"type\":\"completed\",\"contentLength\":3}");
  const chunks = [];
  const stream = new ReadableStream({ start(controller) {
    for (const byte of bytes) controller.enqueue(Uint8Array.of(byte));
    controller.close();
  } });
  assert.equal(await readAssistantEventStream(stream, (chunk) => chunks.push(chunk)), "你🌍");
  assert.deepEqual(chunks, ["你🌍"]);
});

test("completed length mismatch cannot confirm success", async () => {
  await assert.rejects(readAssistantEventStream(streamFrom("{\"type\":\"delta\",\"text\":\"ab\"}\n{\"type\":\"completed\",\"contentLength\":1}\n"), () => {}), /assistant_content_length_mismatch/);
});

test("duplicate terminal events cannot confirm success", async () => {
  await assert.rejects(readAssistantEventStream(streamFrom("{\"type\":\"delta\",\"text\":\"ab\"}\n{\"type\":\"completed\",\"contentLength\":2}\n{\"type\":\"completed\",\"contentLength\":2}\n"), () => {}), /assistant_event_after_completed/);
});

async function mockProviderStream(t, providerBody, callbacks) {
  const oldKey = process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "stream-test-key";
  t.after(() => {
    if (oldKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = oldKey;
  });
  // 仅替换供应商网络边界，实际执行共享的流读取和结算代码。
  t.mock.method(globalThis, "fetch", async () => new Response(providerBody));
  return createDeepSeekAssistantTextStream({
    messages: [{ role: "user", content: "学习夹具" }],
    signal: new AbortController().signal,
    userId: "stream-test-user",
    ...callbacks,
  });
}

const providerDelta = 'data: {"choices":[{"delta":{"content":"好"}}]}\n\n';

test("读者中断后先记录失败，再释放配额", async (t) => {
  const events = [];
  const failed = Promise.withResolvers();
  const provider = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(providerDelta));
    },
    cancel() { events.push("provider-cancelled"); },
  });
  const stream = await mockProviderStream(t, provider, {
    onFailed: async (code) => {
      events.push(code);
      await failed.promise;
      events.push("failed-saved");
    },
    onSettled: () => { events.push("settled"); },
  });
  const reader = stream.getReader();
  assert.equal((await reader.read()).done, false);
  const cancelled = reader.cancel();
  // 给失败回调开始执行的机会，然后才允许持久化完成。
  await new Promise(setImmediate);
  const beforeSaving = [...events];
  failed.resolve();
  await cancelled;
  assert.deepEqual(beforeSaving, ["provider-cancelled", "provider_stream_cancelled"]);
  assert.deepEqual(events, [...beforeSaving, "failed-saved", "settled"]);
});

test("已收到完整正文并开始写成功凭证时，中断不会改写失败终态", async (t) => {
  const events = [];
  const writingSuccess = Promise.withResolvers();
  const allowSave = Promise.withResolvers();
  const stream = await mockProviderStream(t, streamFrom(`${providerDelta}data: [DONE]\n\n`), {
    onCompleted: async (length) => {
      events.push(["completed", length]);
      writingSuccess.resolve();
      await allowSave.promise;
    },
    onFailed: async (code) => { events.push(["failed", code]); },
    onSettled: () => { events.push("settled"); },
  });
  const reader = stream.getReader();
  assert.equal((await reader.read()).done, false);
  await writingSuccess.promise;
  const cancelled = reader.cancel();
  allowSave.resolve();
  await cancelled;
  assert.deepEqual(events, [["completed", 1], "settled"]);
});

test("供应商等待超时写入可识别原因，截断的正文不能通过", async (t) => {
  const timeout = new AbortController();
  const failures = [];
  const provider = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(providerDelta));
      timeout.signal.addEventListener("abort", () => controller.error(new Error()), { once: true });
    },
  });
  const stream = await mockProviderStream(t, provider, {
    signal: timeout.signal,
    onFailed: async (code) => { failures.push(code); },
  });
  const completion = readAssistantEventStream(stream, () => {
    // 模拟已显示部分回答后，供应商连接因截止时间被终止。
    timeout.abort(new DOMException("test deadline", "TimeoutError"));
  });
  await assert.rejects(completion, /provider_stream_timeout/);
  assert.deepEqual(failures, ["provider_stream_timeout"]);
});
