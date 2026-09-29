"use client";

import { useEffect, useRef, useState } from "react";
import {
  COMPANY_TEMPLATE_LOAD_TIMEOUT_MS,
  COMPANY_TEMPLATE_LOAD_TOKEN,
  isCompanyTemplateReadyMessage,
} from "@/lib/company-templates/frame-protocol";

/** 每次打开只加载一份正文；手机切换、模板变化、重试均创建新的消息标识。 */
export function useTemplateFrame(src: string) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [desktop, setDesktop] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<{ src: string; token: string; state: "loading" | "ready" | "failed" } | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!desktop) { setLoad(null); return; }
    const token = crypto.randomUUID();
    const url = new URL(src, window.location.origin);
    url.searchParams.set(COMPANY_TEMPLATE_LOAD_TOKEN, token);
    setLoad({ src: url.toString(), token, state: "loading" });
    // 沙箱来源为 null，不能凭来源域名信任消息；必须是当前 iframe 窗口与当前标识。
    const ready = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow || event.origin !== "null"
        || !isCompanyTemplateReadyMessage(event.data, token)) return;
      setLoad((current) => current?.token === token && current.state === "loading"
        ? { ...current, state: "ready" } : current);
    };
    window.addEventListener("message", ready);
    const timer = window.setTimeout(() => {
      setLoad((current) => current?.token === token && current.state === "loading"
        ? { ...current, state: "failed" } : current);
    }, COMPANY_TEMPLATE_LOAD_TIMEOUT_MS);
    return () => { window.clearTimeout(timer); window.removeEventListener("message", ready); };
  }, [desktop, src, attempt]);
  const fail = () => setLoad((current) => current ? { ...current, state: "failed" } : current);
  return { desktop, frame, load, fail, retry: () => setAttempt((value) => value + 1) };
}
