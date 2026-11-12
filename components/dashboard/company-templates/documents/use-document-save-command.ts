"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDocumentKeyboard } from "./use-document-keyboard";

type SaveShortcut = (copy: boolean) => void;

/** 工具栏、父页和模板沙箱共用普通保存命令，另存为仍由独立表单处理。 */
export function useDocumentSaveCommand({
  enabled,
  shortcutReady,
  bindSaveShortcut,
  exportNow,
  flush,
}: {
  enabled: boolean;
  shortcutReady: boolean;
  bindSaveShortcut: (command: SaveShortcut) => () => void;
  exportNow: () => Promise<Record<string, unknown>>;
  flush: (manual?: boolean) => Promise<boolean>;
}) {
  const [actionError, setActionError] = useState(false);
  const [copySignal, setCopySignal] = useState(0);
  const running = useRef(false);

  const saveNow = useCallback(async () => {
    // 在向 iframe 请求快照前取得锁，避免第二次命令抢占前一个导出请求。
    if (running.current) return false;
    running.current = true;
    setActionError(false);
    try {
      await exportNow();
      return await flush(true);
    } catch {
      setActionError(true);
      return false;
    } finally {
      running.current = false;
    }
  }, [exportNow, flush]);

  const shortcut = useCallback(
    (copy: boolean) => {
      if (!shortcutReady) return;
      if (copy) setCopySignal((value) => value + 1);
      else void saveNow();
    },
    [saveNow, shortcutReady],
  );
  useEffect(() => bindSaveShortcut(shortcut), [bindSaveShortcut, shortcut]);
  useDocumentKeyboard(shortcut, enabled);
  return { actionError, copySignal, saveNow };
}
