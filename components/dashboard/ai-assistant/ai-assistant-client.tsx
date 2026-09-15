"use client";

import { useEffect, useMemo, useState } from "react";

import { usePathname } from "next/navigation";
import { Bot, MessageCircle } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTranslations } from "next-intl";

import { useLocale } from "@/components/i18n/locale-provider";
import type {
  AiAssistantLocale,
  AiAssistantSettlementReleaseAction,
} from "@/lib/ai-assistant/assistant-types";
import { getCompanyText } from "@/lib/company-config";

import { AiAssistantFeedbackBridge } from "./ai-assistant-feedback-bridge";
import { AiAssistantPanel } from "./ai-assistant-panel";
import { useAiAssistantChat } from "./use-ai-assistant-chat";

export function AiAssistantClient() {
  const t = useTranslations("DashboardShell.aiAssistant");
  const pathname = usePathname();
  const { locale } = useLocale();
  const [open, setOpen] = useState(false);
  const assistantLocale: AiAssistantLocale = locale === "en" ? "en" : "zh";
  const companyText = getCompanyText(assistantLocale);
  const copy = useMemo(
    () => ({
      close:
        assistantLocale === "en"
          ? `Close ${companyText.assistantName}`
          : `关闭${companyText.assistantName}`,
      feedbackEntry: {
        action: t("feedbackAction"),
        assistantReplyLabel: t("feedbackDraftAssistantLabel"),
        draftExpectation: t("feedbackDraftExpectation"),
        draftIntro:
          assistantLocale === "en"
            ? `I ran into this while using ${companyText.assistantName}:`
            : `我在使用${companyText.assistantName}时遇到这个问题：`,
        draftTitle:
          assistantLocale === "en"
            ? `${companyText.assistantName} did not solve my problem`
            : `${companyText.assistantName}没有解决我的问题`,
        errorDescription: t("feedbackErrorDescription"),
        errorLabel: t("feedbackDraftErrorLabel"),
        explicitDescription: t("feedbackExplicitDescription"),
        unableDescription: t("feedbackUnableDescription"),
        userQuestionLabel: t("feedbackDraftUserQuestionLabel"),
      },
      greeting: t("greeting"),
      inputLabel: t("inputLabel"),
      open:
        assistantLocale === "en"
          ? `Open ${companyText.assistantName}`
          : `打开${companyText.assistantName}`,
      placeholder: t("placeholder"),
      reset: t("reset"),
      resetConfirmAction: t("resetConfirmAction"),
      resetConfirmCancel: t("resetConfirmCancel"),
      resetConfirmDescription: t("resetConfirmDescription"),
      requestTooLarge: t("requestTooLarge"),
      resultConfirming: t("resultConfirming"),
      send: t("send"),
      serviceUnavailable: t("serviceUnavailable"),
      settlementRelease: {
        amountLabel: t("settlementAmount"),
        cancel: t("settlementCancel"),
        cancelled: t("settlementCancelled"),
        cancelledMessage: (action: AiAssistantSettlementReleaseAction) =>
          t("settlementCancelledMessage", {
            customer: action.customerName,
          }),
        confirmationIntro: t("settlementConfirmationIntro"),
        confirm: t("settlementConfirm"),
        customerLabel: t("settlementCustomer"),
        dateLabel: t("settlementDate"),
        errorMessages: {
          customerChanged: t("settlementErrorCustomerChanged"),
          forbidden: t("settlementErrorForbidden"),
          invalidInput: t("settlementErrorInvalidInput"),
          notSignedIn: t("settlementErrorNotSignedIn"),
          requestConflict: t("settlementErrorRequestConflict"),
          requestTooLarge: t("settlementErrorRequestTooLarge"),
          serviceUnavailable: t("settlementErrorServiceUnavailable"),
        },
        existingCustomer: t("settlementExistingCustomer"),
        guidance: {
          ambiguousCustomer: t("settlementGuidanceAmbiguousCustomer"),
          invalidAmount: t("settlementGuidanceInvalidAmount"),
          invalidCurrency: t("settlementGuidanceInvalidCurrency"),
          invalidDate: t("settlementGuidanceInvalidDate"),
          missingAmount: t("settlementGuidanceMissingAmount"),
          missingCurrency: t("settlementGuidanceMissingCurrency"),
          missingCustomer: t("settlementGuidanceMissingCustomer"),
          multipleAmounts: t("settlementGuidanceMultipleAmounts"),
          notAllowed: t("settlementGuidanceNotAllowed"),
        },
        inputCustomerLabel: t("settlementInputCustomer"),
        noNote: t("settlementNoNote"),
        noteLabel: t("settlementNote"),
        published: t("settlementPublished"),
        publishedMessage: (action: AiAssistantSettlementReleaseAction) =>
          t("settlementPublishedMessage", {
            amount: formatSettlementAmount(action.amount, assistantLocale),
            currency: action.currency,
            customer: action.customerName,
            date: action.receivedOn,
          }),
        publishing: t("settlementPublishing"),
        retry: t("settlementRetry"),
        temporaryCustomer: t("settlementTemporaryCustomer"),
        title: t("settlementTitle"),
      },
      thinking: t("thinking"),
      title: companyText.assistantName,
      tooManyRequests: t("tooManyRequests"),
    }),
    [assistantLocale, companyText.assistantName, t],
  );
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
    <AiAssistantFeedbackBridge>
      {({ openFeedback }) => (
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
                onOpenFeedback={openFeedback}
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
                {open ? (
                  <Bot className="size-6" />
                ) : (
                  <MessageCircle className="size-6" />
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </>
      )}
    </AiAssistantFeedbackBridge>
  );
}

function formatSettlementAmount(
  amount: number,
  locale: AiAssistantLocale,
) {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(amount);
}
