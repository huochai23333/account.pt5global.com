"use client";

import { Button } from "@/components/ui/button";
import { useTemplateFrame } from "./use-template-frame";

/** 仅宽屏挂载 iframe，手机直接访问模板链接时也不会加载可编辑正文。 */
export function CompanyTemplateDesktopFrame({ notice, src, title, loading, failed, retry }: {
  notice: string;
  src: string;
  title: string;
  loading: string;
  failed: string;
  retry: string;
}) {
  const { desktop, frame, load, fail, retry: reopen } = useTemplateFrame(src);
  const state = load?.state ?? "loading";
  if (!desktop) return <p className="p-6 text-center text-sm text-content-muted">{notice}</p>;
  return <div className="relative min-h-[680px]">
    {state !== "ready" ? <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface-panel p-4 text-center text-sm text-content-muted" role="status">
      <span>{state === "loading" ? loading : failed}</span>
      {state === "failed" ? <Button onClick={reopen} type="button" variant="outline">{retry}</Button> : null}
    </div> : null}
    {load ? <iframe
      key={load.token}
      ref={frame}
      className="h-[calc(100vh-13rem)] min-h-[680px] w-full bg-surface-panel"
      onError={fail}
      referrerPolicy="no-referrer"
      sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-popups"
      src={load.src}
      title={title}
    /> : null}
  </div>;
}
