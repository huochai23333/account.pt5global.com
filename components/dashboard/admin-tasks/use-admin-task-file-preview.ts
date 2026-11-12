"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AdminTaskFilePreviewItem } from "./admin-task-file-preview-dialog";

type PreviewRequestHandlers<Item> = {
  load: () => Promise<Item>;
  onReady: (item: Item) => void;
  onError: (error: unknown) => void;
  onFinish: () => void;
};

// 只发布最后一次选择的签名链接。关闭弹窗或离开页面会使进行中的读回失效。
export function createTaskFilePreviewLoader() {
  let version = 0;
  return {
    invalidate() {
      version += 1;
    },
    async load<Item>({ load, onReady, onError, onFinish }: PreviewRequestHandlers<Item>) {
      const requestVersion = ++version;
      try {
        const item = await load();
        if (requestVersion === version) onReady(item);
      } catch (error) {
        if (requestVersion === version) onError(error);
      } finally {
        if (requestVersion === version) onFinish();
      }
    },
  };
}

export function useAdminTaskFilePreview<Item extends AdminTaskFilePreviewItem>() {
  const [loader] = useState(createTaskFilePreviewLoader);
  const [previewItem, setPreviewItem] = useState<Item | null>(null);
  const [previewBusyKey, setPreviewBusyKey] = useState<string | null>(null);
  const currentKey = useRef<string | null>(null);

  useEffect(() => () => loader.invalidate(), [loader]);

  const openPreview = useCallback(async (
    key: string,
    load: () => Promise<Item>,
    onError: (error: unknown) => void,
  ) => {
    if (currentKey.current === key) return;
    currentKey.current = key;
    setPreviewBusyKey(key);
    await loader.load({
      load,
      onReady: setPreviewItem,
      onError,
      onFinish: () => {
        currentKey.current = null;
        setPreviewBusyKey(null);
      },
    });
  }, [loader]);

  const closePreview = useCallback(() => {
    loader.invalidate();
    currentKey.current = null;
    setPreviewBusyKey(null);
    setPreviewItem(null);
  }, [loader]);

  return { closePreview, openPreview, previewBusyKey, previewItem };
}

export function downloadTaskFileBlob(blob: Blob, fileName: string) {
  // 给浏览器留出读取下载对象的时间，再释放临时地址。
  const objectUrl = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 30_000);
}
