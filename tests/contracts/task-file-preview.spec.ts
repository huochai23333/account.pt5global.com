import { expect, test } from "@playwright/test";

import { createTaskFilePreviewLoader } from "../../components/dashboard/admin-tasks/use-admin-task-file-preview";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

function previewFixture() {
  const loader = createTaskFilePreviewLoader();
  const events: string[] = [];
  const open = (key: string, promise: Promise<string>) => loader.load({
    load: () => promise,
    onReady: (file) => events.push(file),
    onError: () => events.push(`error:${key}`),
    onFinish: () => events.push(`finish:${key}`),
  });
  return { loader, events, open };
}

test("较慢的旧签名地址不能覆盖最新选择的附件", async () => {
  const preview = previewFixture();
  const first = deferred<string>();
  const firstRequest = preview.open("first", first.promise);
  await preview.open("second", Promise.resolve("signed-second"));
  first.resolve("signed-first");
  await firstRequest;

  expect(preview.events).toEqual(["signed-second", "finish:second"]);
});

test("关闭预览后忽略尚未返回的签名地址", async () => {
  const preview = previewFixture();
  const pending = deferred<string>();
  const request = preview.open("old", pending.promise);
  preview.loader.invalidate();
  pending.resolve("signed-old");
  await request;

  expect(preview.events).toEqual([]);
});

test("过期请求失败不覆盖新状态，当前失败仍结束加载", async () => {
  const preview = previewFixture();
  const first = deferred<string>();
  const firstRequest = preview.open("first", first.promise);
  await preview.open("second", Promise.reject(new Error("signed URL denied")));
  first.reject(new Error("old failure"));
  await firstRequest;

  expect(preview.events).toEqual(["error:second", "finish:second"]);
});
