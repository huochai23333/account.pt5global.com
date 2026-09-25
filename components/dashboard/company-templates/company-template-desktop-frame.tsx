"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** 仅宽屏挂载 iframe，手机直接访问模板链接时也不会加载可编辑正文。 */
export function CompanyTemplateDesktopFrame({ notice, src, title, loading, failed, retry }: {
  notice: string;
  src: string;
  title: string;
  loading: string;
  failed: string;
  retry: string;
}) {
  const [desktop, setDesktop] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [responseReady, setResponseReady] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    // 从手机宽度切回电脑，或切换模板时，iframe 会重新挂载，必须重新显示等待状态。
    setFrameLoaded(false);
    setResponseReady(false);
    setState("loading");
  }, [desktop, src]);
  useEffect(() => {
    if (!desktop) return;
    const controller = new AbortController();
    // 沙箱 iframe 无同源权限，父页面不能读其响应状态；并行 HEAD 只验证状态，不接触正文。
    void fetch(src, { method: "HEAD", cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("template unavailable");
        setResponseReady(true);
      })
      .catch(() => { if (!controller.signal.aborted) setState("failed"); });
    return () => controller.abort();
  }, [desktop, src, attempt]);
  useEffect(() => {
    if (state === "loading" && frameLoaded && responseReady) setState("ready");
  }, [state, frameLoaded, responseReady]);
  useEffect(() => {
    if (!desktop || state !== "loading") return;
    // 网络长时间无响应时给出重试入口；切换模板或重试时会清除旧计时器。
    const timer = window.setTimeout(() => setState("failed"), 15_000);
    return () => window.clearTimeout(timer);
  }, [desktop, state, attempt, src]);
  if (!desktop) return <p className="p-6 text-center text-sm text-content-muted">{notice}</p>;
  return <div className="relative min-h-[680px]">
    {state !== "ready" ? <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface-panel p-4 text-center text-sm text-content-muted" role="status">
      <span>{state === "loading" ? loading : failed}</span>
      {state === "failed" ? <Button onClick={() => { setFrameLoaded(false); setResponseReady(false); setState("loading"); setAttempt((value) => value + 1); }} type="button" variant="outline">{retry}</Button> : null}
    </div> : null}
    <iframe
      key={`${src}-${attempt}`}
      className="h-[calc(100vh-13rem)] min-h-[680px] w-full bg-surface-panel"
      onError={() => setState("failed")}
      onLoad={() => setFrameLoaded(true)}
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-popups"
      src={src}
      title={title}
    />
  </div>;
}
