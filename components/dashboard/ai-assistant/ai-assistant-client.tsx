/** 工作台 AI 助手：组合或展示本模块已准备的数据；交互回调沿上层状态与服务处理，不在展示中重新实现业务规则。 */
"use client";

import { useEffect, useState } from "react";

import { usePathname } from "next/navigation";
import { Bot, MessageCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import { useLocale } from "@/components/i18n/locale-provider";
import type { AiAssistantLocale } from "@/lib/ai-assistant/assistant-types";

import { AiAssistantPanel } from "./ai-assistant-panel";
import { useAiAssistantChat } from "./use-ai-assistant-chat";
import { useAiAssistantCopy } from "./use-ai-assistant-copy";

export function AiAssistantClient() {
  const pathname = usePathname();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const assistantLocale: AiAssistantLocale = locale === "en" ? "en" : "zh";
  const copy = useAiAssistantCopy(assistantLocale);
  const chat = useAiAssistantChat({
    copy,
    locale: assistantLocale,
    pathname,
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <AnimatePresence>
        {open ? (
          <AiAssistantPanel
            busy={chat.busy}
            copy={copy}
            errorMessage={chat.errorMessage}
            input={chat.input}
            locale={assistantLocale}
            messages={chat.messages}
            onCancelSettlementRelease={chat.cancelSettlementRelease}
            onClose={() => setOpen(false)}
            onConfirmSettlementRelease={chat.confirmSettlementRelease}
            onInputChange={chat.setInput}
            onReset={chat.reset}
            onSend={chat.sendMessage}
            pending={chat.pending}
          />
        ) : null}
      </AnimatePresence>

      <motion.button
        aria-expanded={open}
        aria-label={copy.open}
        className="z-40 mb-5 mr-4 ml-auto flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-surface-interactive transition hover:bg-brand-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/50 sm:fixed sm:right-6 sm:bottom-6 sm:mb-0 sm:mr-0"
        data-testid="ai-assistant-launcher"
        onClick={() => setOpen((current) => !current)}
        type="button"
        whileTap={{ scale: 0.94 }}
      >
        <AnimatePresence initial={false} mode="wait">
          <motion.span
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: open ? -12 : 12, scale: 0.86 }}
            initial={{ opacity: 0, rotate: open ? 12 : -12, scale: 0.86 }}
            key={open ? "assistant-open" : "assistant-closed"}
          >
            {open ? <Bot className="size-6" /> : <MessageCircle className="size-6" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </>
  );
}
