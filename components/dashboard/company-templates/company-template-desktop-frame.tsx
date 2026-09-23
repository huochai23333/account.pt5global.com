"use client";

import { useEffect, useState } from "react";

/** 仅宽屏挂载 iframe，手机直接访问模板链接时也不会加载可编辑正文。 */
export function CompanyTemplateDesktopFrame({ notice, src, title }: {
  notice: string;
  src: string;
  title: string;
}) {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return desktop ? <iframe
    className="h-[calc(100vh-13rem)] min-h-[680px] w-full bg-surface-panel"
    referrerPolicy="no-referrer"
    sandbox="allow-scripts allow-forms allow-modals allow-downloads allow-popups"
    src={src}
    title={title}
  /> : <p className="p-6 text-center text-sm text-content-muted">{notice}</p>;
}
