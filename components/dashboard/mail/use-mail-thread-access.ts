"use client";

import { useEffect } from "react";

const ACCESS_RECHECK_MS = 5_000;

/** 详情已经发到浏览器，负责人变更后要主动重新向服务端确认还能否查看。 */
export function useMailThreadAccess({
  threadId,
  getViewThreadId,
  getViewVersion,
  onUnavailable,
}: {
  threadId: string | null;
  getViewThreadId: () => string | null;
  getViewVersion: () => number;
  onUnavailable: (threadId: string) => void;
}) {
  useEffect(() => {
    const watchedThreadId = threadId;
    if (!watchedThreadId) return;
    const lifecycle = new AbortController();
    let checking = false;

    const recheck = async () => {
      if (checking || document.visibilityState !== "visible" || getViewThreadId() !== watchedThreadId) return;
      const version = getViewVersion();
      checking = true;
      try {
        const response = await fetch(`/api/mail/threads/${watchedThreadId}`, {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.any([lifecycle.signal, AbortSignal.timeout(4_000)]),
        });
        // 只有明确的权限结果才收起邮件。网络中断和服务故障会在下次检查重试。
        if (response.ok) return;
        if (!lifecycle.signal.aborted && getViewVersion() === version &&
            (response.status === 404 || response.status === 401)) {
          onUnavailable(watchedThreadId);
        }
      } catch {
        // 请求失败无法确认权限变化。
      } finally {
        checking = false;
      }
    };

    const timer = window.setInterval(recheck, ACCESS_RECHECK_MS);
    document.addEventListener("visibilitychange", recheck);
    return () => {
      lifecycle.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", recheck);
    };
  }, [getViewThreadId, getViewVersion, onUnavailable, threadId]);
}
