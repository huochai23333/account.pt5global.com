"use client";

import { useEffect, useRef, useState } from "react";

import { Bot, LoaderCircle, RefreshCw, Send, UserRound, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";

import {
  MotionList,
  MotionListItem,
} from "@/components/motion/motion-primitives";
import { Button, InteractiveButton as DesignButton } from "@/components/ui/button";
import * as FormControls from "@/components/ui/form-controls";
import { MOTION_DURATION, MOTION_EASING } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";

import { AiAssistantSettlementReleaseCard } from "./ai-assistant-settlement-release-card";
import type {
  AiAssistantSettlementReleaseCopy,
  AiAssistantUiMessage,
} from "./ai-assistant-ui-types";

type AiAssistantPanelCopy = {
  close: string;
  inputLabel: string;
  placeholder: string;
  reset: string;
  resetConfirmAction: string;
  resetConfirmCancel: string;
  resetConfirmDescription: string;
  send: string;
  settlementRelease: AiAssistantSettlementReleaseCopy;
  thinking: string;
  title: string;
};

type AiAssistantPanelProps = {
  busy: boolean;
  copy: AiAssistantPanelCopy;
  errorMessage: string | null;
  input: string;
  locale: "en" | "zh";
  messages: AiAssistantUiMessage[];
  onCancelSettlementRelease: (messageId: string) => void;
  onClose: () => void;
  onConfirmSettlementRelease: (messageId: string) => void;
  onInputChange: (value: string) => void;
  onReset: () => void;
  onSend: () => void;
  pending: boolean;
};

export function AiAssistantPanel({
  busy,
  copy,
  errorMessage,
  input,
  locale,
  messages,
  onCancelSettlementRelease,
  onClose,
  onConfirmSettlementRelease,
  onInputChange,
  onReset,
  onSend,
  pending,
}: AiAssistantPanelProps) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [errorMessage, messages, pending]);

  return (
    <motion.section
      animate={{ opacity: 1, scale: 1, y: 0 }}
      aria-label={copy.title}
      className="fixed bottom-[5.5rem] right-3 z-40 flex h-[min(640px,calc(100dvh-7rem))] w-[calc(100vw-1.5rem)] max-w-[420px] flex-col overflow-hidden rounded-surface-panel border border-surface-panel-border bg-surface-overlay shadow-surface-floating backdrop-blur-2xl backdrop-saturate-150 sm:bottom-24 sm:right-6"
      exit={{ opacity: 0, scale: 0.98, y: 18 }}
      initial={{ opacity: 0, scale: 0.96, y: 24 }}
      transition={{
        duration: MOTION_DURATION.overlay,
        ease: MOTION_EASING.enter,
      }}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <Bot className="size-5" />
          </div>
          <h2 className="truncate text-base font-semibold text-content-strong">
            {copy.title}
          </h2>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <DesignButton
            aria-label={copy.reset}
            className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-medium text-primary transition-colors hover:bg-status-info-soft disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            onClick={() => setResetConfirmOpen(true)}
            type="button"
          >
            <RefreshCw className="size-4" />
            <span>{copy.reset}</span>
          </DesignButton>
          <DesignButton
            aria-label={copy.close}
            className="flex h-9 w-9 items-center justify-center rounded-full text-content-muted transition-colors hover:bg-status-info-soft"
            onClick={onClose}
            type="button"
          >
            <X className="size-4" />
          </DesignButton>
        </div>
      </div>

      <AnimatePresence>
        {resetConfirmOpen ? (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="border-b border-border-subtle bg-surface-inset px-4 py-3"
            exit={{ opacity: 0, y: -8 }}
            initial={{ opacity: 0, y: -8 }}
            transition={{
              duration: MOTION_DURATION.feedback,
              ease: MOTION_EASING.enter,
            }}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6 text-content-muted">
                {copy.resetConfirmDescription}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <DesignButton
                  className="h-8 rounded-full px-3 text-sm font-medium text-content-muted transition-colors hover:bg-surface-interactive"
                  onClick={() => setResetConfirmOpen(false)}
                  type="button"
                >
                  {copy.resetConfirmCancel}
                </DesignButton>
                <DesignButton
                  className="h-8 rounded-full bg-primary px-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
                  onClick={() => {
                    onReset();
                    setResetConfirmOpen(false);
                    window.requestAnimationFrame(() =>
                      inputRef.current?.focus(),
                    );
                  }}
                  type="button"
                >
                  {copy.resetConfirmAction}
                </DesignButton>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <MotionList className="flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        {messages
          .filter((message) => message.content.length > 0)
          .map((message, index) => (
            <MotionListItem index={index} key={message.id}>
              <AssistantMessageBubble
                copy={copy.settlementRelease}
                locale={locale}
                message={message}
                onCancelSettlementRelease={onCancelSettlementRelease}
                onConfirmSettlementRelease={onConfirmSettlementRelease}
              />
            </MotionListItem>
          ))}

        {pending ? (
          <MotionListItem key="assistant-thinking">
            <div className="flex justify-start">
              <div className="flex max-w-[84%] items-center gap-2 rounded-surface-inset border border-border-subtle bg-surface-interactive px-4 py-3 text-sm text-content-muted shadow-surface-interactive">
                <LoaderCircle className="size-4 animate-spin" />
                {copy.thinking}
              </div>
            </div>
          </MotionListItem>
        ) : null}

        {errorMessage ? (
          <MotionListItem key="assistant-error">
            <div
              className="rounded-record-card border border-border-subtle bg-status-danger-soft px-4 py-3 text-sm leading-6 text-content-muted"
              role="alert"
            >
              {errorMessage}
            </div>
          </MotionListItem>
        ) : null}

        <div ref={messageEndRef} />
      </MotionList>

      <form
        className="border-t border-border-subtle bg-surface-panel p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void onSend();
        }}
      >
        <FormControls.Field
          controlId="ai-assistant-input"
          label={copy.inputLabel}
          labelHidden
        >
          <div className="flex items-end gap-2 rounded-control-large border border-border-subtle bg-surface-interactive p-2 focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/30">
            <FormControls.Textarea
              className="max-h-28 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-content-strong outline-none placeholder:text-content-muted"
              disabled={busy}
              id="ai-assistant-input"
              onChange={(event) => onInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void onSend();
                }
              }}
              placeholder={copy.placeholder}
              ref={inputRef}
              rows={1}
              value={input}
            />
            <Button
              aria-label={copy.send}
              disabled={!input.trim() || busy}
              size="icon-compact"
              type="submit"
              variant="primary"
            >
              {pending ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </FormControls.Field>
      </form>
    </motion.section>
  );
}

function AssistantMessageBubble({
  copy,
  locale,
  message,
  onCancelSettlementRelease,
  onConfirmSettlementRelease,
}: {
  copy: AiAssistantSettlementReleaseCopy;
  locale: "en" | "zh";
  message: AiAssistantUiMessage;
  onCancelSettlementRelease: (messageId: string) => void;
  onConfirmSettlementRelease: (messageId: string) => void;
}) {
  const fromUser = message.role === "user";
  const hasSettlementRelease = Boolean(message.settlementRelease);

  return (
    <div
      className={cn("flex gap-2", fromUser ? "justify-end" : "justify-start")}
    >
      {!fromUser ? (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-status-info-soft text-primary">
          <Bot className="size-3.5" />
        </div>
      ) : null}
      <div
        className={cn(
          "whitespace-pre-wrap rounded-surface-inset px-4 py-3 text-sm leading-6 shadow-surface-interactive",
          hasSettlementRelease ? "min-w-0 flex-1" : "max-w-[84%]",
          fromUser
            ? "bg-primary text-white"
            : "border border-border-subtle bg-surface-interactive text-content-muted",
        )}
      >
        {message.content}
        {message.settlementRelease ? (
          <AiAssistantSettlementReleaseCard
            copy={copy}
            locale={locale}
            messageId={message.id}
            onCancel={onCancelSettlementRelease}
            onConfirm={onConfirmSettlementRelease}
            settlementRelease={message.settlementRelease}
          />
        ) : null}
      </div>
      {fromUser ? (
        <div className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-inset text-content-muted">
          <UserRound className="size-3.5" />
        </div>
      ) : null}
    </div>
  );
}
